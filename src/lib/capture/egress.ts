import "server-only";
import net from "node:net";
import tls from "node:tls";

/*
 * THE ONLY DOOR TO THE OUTSIDE FOR THE CAPTURE.
 *
 * Every call to the Diário de Justiça Eletrônico Nacional and to the DataJud
 * passes through here, and every one of them runs on the server. The browser of
 * a lawyer never speaks to a court: it speaks to this application, and this
 * application speaks to the court. Where the lawyer is has no effect on
 * anything, and a lawyer travelling abroad uses the system exactly as he uses it
 * from his desk.
 *
 * In production the egress is direct, because the server of the office is in
 * Brazil and the sources answer it. That is the whole of production, and
 * production does not know that anything else exists.
 *
 * In development the machine of the developer may be outside Brazil, where the
 * distribution of the DJEN refuses the connection by country. For that case, and
 * only for that case, the egress may be routed through a tunnel opened by the
 * office itself against its own server, with the dynamic port forwarding of SSH.
 * No paid network, no third party proxy and no external service: the far end of
 * the tunnel is the same server that runs production.
 *
 * If the variable names a tunnel and the tunnel is not open, the call fails and
 * says so. Nothing here ever simulates an answer.
 */

const SOCKS_VERSION = 0x05;
const NO_AUTHENTICATION = 0x00;
const COMMAND_CONNECT = 0x01;
const ADDRESS_DOMAIN = 0x03;
const ADDRESS_IPV4 = 0x01;
const ADDRESS_IPV6 = 0x04;

export type EgressMode = {
  kind: "direct" | "tunnel";
  proxyUrl: string | null;
  reason: string;
};

/*
 * Which door this process uses. The variable is only read outside production,
 * so a value left behind in a production environment can never reroute the
 * traffic of the office.
 */
export function egressMode(): EgressMode {
  const configured = process.env.CAPTURE_SOCKS_PROXY?.trim();
  if (process.env.NODE_ENV === "production") {
    return {
      kind: "direct",
      proxyUrl: null,
      reason:
        "Produção: a saída é direta, porque o servidor do escritório já está no Brasil.",
    };
  }
  if (configured === undefined || configured.length === 0) {
    return {
      kind: "direct",
      proxyUrl: null,
      reason:
        "Desenvolvimento sem túnel configurado: a saída é direta e depende da rede desta máquina.",
    };
  }
  return {
    kind: "tunnel",
    proxyUrl: configured,
    reason: `Desenvolvimento com túnel: a saída passa por ${configured}, aberto pelo próprio escritório contra o seu servidor.`,
  };
}

type ConnectOptions = {
  hostname: string;
  /* undici hands the port over as an empty string when the address carries the
   * default port of the scheme, so an absent port is not undefined here. */
  port?: number | string | null;
  protocol?: string;
  servername?: string | null;
};

type ConnectCallback = (error: Error | null, socket?: net.Socket) => void;

/*
 * One SOCKS5 handshake, without authentication, which is what the dynamic port
 * forwarding of SSH offers. Written here instead of taken from a package: the
 * protocol is a dozen bytes, and a dependency in the path that reaches the
 * courts is a dependency in the path that reaches the courts.
 */
function socksConnect(proxy: URL) {
  return (options: ConnectOptions, callback: ConnectCallback): void => {
    const targetHost = options.hostname;
    const declaredPort =
      options.port === undefined || options.port === null || options.port === ""
        ? Number.NaN
        : Number(options.port);
    const targetPort =
      Number.isFinite(declaredPort) && declaredPort > 0
        ? declaredPort
        : options.protocol === "http:"
          ? 80
          : 443;

    const socket = net.connect({
      host: proxy.hostname,
      port: Number(proxy.port || 1080),
    });

    let stage: "greeting" | "request" | "done" = "greeting";
    let buffer = Buffer.alloc(0);

    const fail = (message: string) => {
      socket.destroy();
      callback(new Error(message));
    };

    socket.once("error", (error) => {
      if (stage !== "done") {
        callback(
          new Error(
            `O túnel de saída em ${proxy.host} não respondeu: ${error.message}`,
          ),
        );
      }
    });

    socket.on("connect", () => {
      socket.write(Buffer.from([SOCKS_VERSION, 1, NO_AUTHENTICATION]));
    });

    socket.on("data", (chunk: Buffer) => {
      if (stage === "done") {
        return;
      }
      buffer = Buffer.concat([buffer, chunk]);

      if (stage === "greeting") {
        if (buffer.length < 2) {
          return;
        }
        if (buffer[0] !== SOCKS_VERSION || buffer[1] !== NO_AUTHENTICATION) {
          fail(
            "O túnel de saída recusou a negociação SOCKS5 sem autenticação.",
          );
          return;
        }
        buffer = buffer.subarray(2);
        stage = "request";

        const host = Buffer.from(targetHost, "utf8");
        const request = Buffer.alloc(7 + host.length);
        request[0] = SOCKS_VERSION;
        request[1] = COMMAND_CONNECT;
        request[2] = 0x00;
        request[3] = ADDRESS_DOMAIN;
        request[4] = host.length;
        host.copy(request, 5);
        request.writeUInt16BE(targetPort, 5 + host.length);
        socket.write(request);
      }

      if (stage === "request") {
        if (buffer.length < 5) {
          return;
        }
        const reply = buffer[1];
        if (reply !== 0x00) {
          fail(
            `O túnel de saída recusou a conexão com ${targetHost}, código ${reply}.`,
          );
          return;
        }
        const addressType = buffer[3];
        const addressLength =
          addressType === ADDRESS_IPV4
            ? 4
            : addressType === ADDRESS_IPV6
              ? 16
              : addressType === ADDRESS_DOMAIN
                ? (buffer[4] ?? 0) + 1
                : -1;
        if (addressLength < 0) {
          fail("O túnel de saída respondeu um endereço que não foi entendido.");
          return;
        }
        const total = 4 + addressLength + 2;
        if (buffer.length < total) {
          return;
        }
        buffer = buffer.subarray(total);
        stage = "done";
        socket.removeAllListeners("data");

        if (options.protocol === "http:") {
          callback(null, socket);
          return;
        }
        const secure = tls.connect({
          socket,
          servername: options.servername ?? targetHost,
          ALPNProtocols: ["http/1.1"],
        });
        secure.once("secureConnect", () => {
          callback(null, secure as unknown as net.Socket);
        });
        secure.once("error", (error) => {
          callback(
            new Error(
              `A conexão segura com ${targetHost}, através do túnel, falhou: ${error.message}`,
            ),
          );
        });
      }
    });
  };
}

let cachedDispatcher: unknown = null;
let cachedProxy: string | null = null;

/*
 * The fetch of the capture. Everything that leaves this application towards a
 * court goes through this function, so there is exactly one place to audit.
 */
export async function captureFetch(
  url: string,
  init: RequestInit & { signal?: AbortSignal },
): Promise<Response> {
  const mode = egressMode();
  if (mode.kind === "direct" || mode.proxyUrl === null) {
    return fetch(url, init);
  }

  const undici = await import("undici");
  if (cachedDispatcher === null || cachedProxy !== mode.proxyUrl) {
    const proxy = new URL(mode.proxyUrl);
    if (!proxy.protocol.startsWith("socks")) {
      throw new Error(
        "CAPTURE_SOCKS_PROXY precisa ser um endereço socks5, por exemplo socks5://127.0.0.1:1080.",
      );
    }
    cachedDispatcher = new undici.Agent({
      connect: socksConnect(proxy) as never,
    });
    cachedProxy = mode.proxyUrl;
  }

  const request = { ...init, dispatcher: cachedDispatcher } as Record<
    string,
    unknown
  >;
  return (await undici.fetch(url, request as never)) as unknown as Response;
}
