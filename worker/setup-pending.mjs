const html = "<!doctype html>\n<html lang=\"en\">\n<head>\n  <meta charset=\"utf-8\">\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n  <meta name=\"robots\" content=\"noindex, nofollow\">\n  <meta name=\"theme-color\" content=\"#0B1730\">\n  <title>Speak Station — Setup in Progress</title>\n  <style>\n    * { box-sizing: border-box; }\n    body { margin: 0; min-height: 100vh; display: grid; place-items: center;\n      background: #f5f7fb; color: #13213a; font: 16px/1.6 system-ui, -apple-system, \"Segoe UI\", sans-serif; }\n    main { max-width: 620px; margin: 24px; padding: 46px; border-radius: 22px;\n      background: #fff; border: 1px solid #dbe4f0; box-shadow: 0 14px 55px #172f5110; }\n    .eyebrow { color: #496a96; letter-spacing: .12em; font-size: 12px;\n      font-weight: 800; text-transform: uppercase; }\n    h1 { font-size: clamp(30px, 5vw, 42px); line-height: 1.15; letter-spacing: -.035em; margin: 14px 0 18px; }\n    p { color: #40516a; margin: 14px 0; }\n    .status { margin-top: 28px; padding: 16px; background: #edf3fb; border-radius: 12px;\n      color: #264468; font-weight: 600; }\n    footer { margin-top: 28px; font-size: 13px; color: #6b7890; }\n  </style>\n</head>\n<body>\n  <main>\n    <div class=\"eyebrow\">Speak Station</div>\n    <h1>We're setting things up.</h1>\n    <p>Your Speak Station website address is being prepared for IELTS speaking practice.</p>\n    <p>Practice accounts, speaking assessments and administrator tools are <strong>not active yet</strong>.\n       They will be available after the database and sign-in setup is completed.</p>\n    <div class=\"status\">Initial website setup in progress</div>\n    <footer>This is a temporary setup page, not the complete application.</footer>\n  </main>\n</body>\n</html>";

export default {
  fetch(request) {
    const pathname = new URL(request.url).pathname;
    const headers = {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    };
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Website setup pending", { status: 503, headers });
    }
    if (pathname.startsWith("/api/") || pathname === "/callback" ||
        pathname.startsWith("/signin-") || pathname.startsWith("/signout-")) {
      return new Response("Website setup pending", { status: 503, headers });
    }
    return new Response(request.method === "HEAD" ? null : html, {
      status: 200,
      headers: {
        ...headers,
        "Content-Type": "text/html; charset=UTF-8",
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
      },
    });
  },
};
