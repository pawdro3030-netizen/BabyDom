export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  try {
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "Brak RESEND_API_KEY w Vercel.",
      });
    }

    const response = await fetch(
      "https://api.resend.com/emails",
      {
        method: "POST",

        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          // Dopóki nie mamy własnej zweryfikowanej domeny,
          // korzystamy z testowego nadawcy Resend.
          from: "BabyDom <onboarding@resend.dev>",

          // W trybie testowym Resend pozwala wysyłać
          // tylko na adres właściciela konta.
          to: [
            "babydomcontaact@outlook.com"
          ],

          subject: "Test e-mail BabyDom",

          html: `
            <!doctype html>
            <html lang="pl">
              <body
                style="
                  margin:0;
                  padding:0;
                  background:#fff8fb;
                  font-family:Arial,Helvetica,sans-serif;
                  color:#2c2630;
                "
              >

                <div
                  style="
                    max-width:600px;
                    margin:0 auto;
                    padding:40px 20px;
                  "
                >

                  <div
                    style="
                      background:#ffffff;
                      border:1px solid #f0e3e9;
                      border-radius:24px;
                      padding:40px 30px;
                      text-align:center;
                    "
                  >

                    <div
                      style="
                        width:70px;
                        height:70px;
                        line-height:70px;
                        margin:0 auto 25px;
                        border-radius:50%;
                        background:#f8edf2;
                        font-size:32px;
                      "
                    >
                      ✓
                    </div>

                    <h1
                      style="
                        margin:0 0 20px;
                        font-size:32px;
                        color:#2c2630;
                      "
                    >
                      BabyDom
                    </h1>

                    <h2
                      style="
                        margin:0 0 16px;
                        font-size:24px;
                        color:#2c2630;
                      "
                    >
                      Test wysyłki działa 🎉
                    </h2>

                    <p
                      style="
                        margin:0 0 15px;
                        font-size:16px;
                        line-height:1.6;
                        color:#6d6269;
                      "
                    >
                      To jest testowa wiadomość wysłana
                      z serwera sklepu BabyDom działającego
                      na Vercel.
                    </p>

                    <p
                      style="
                        margin:0;
                        font-size:16px;
                        line-height:1.6;
                        color:#6d6269;
                      "
                    >
                      Jeśli widzisz tę wiadomość,
                      integracja BabyDom z Resend
                      działa poprawnie.
                    </p>

                  </div>

                  <p
                    style="
                      text-align:center;
                      margin-top:20px;
                      font-size:12px;
                      color:#9a8e94;
                    "
                  >
                    BabyDom
                  </p>

                </div>

              </body>
            </html>
          `,
        }),
      }
    );

    const data =
      await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error("Resend error:", data);

      return res.status(502).json({
        error: "Resend odrzucił wiadomość.",
        details: data,
      });
    }

    return res.status(200).json({
      success: true,
      message: "E-mail został wysłany.",
      id: data.id,
    });

  } catch (error) {
    console.error("test-email error:", error);

    return res.status(500).json({
      error: "Błąd podczas wysyłania wiadomości.",
      details: String(error?.message || error),
    });
  }
}
