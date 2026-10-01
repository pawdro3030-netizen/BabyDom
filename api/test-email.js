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
          from: "BabyDom <onboarding@resend.dev>",

          to: [
            "BabyDomContaact@outlook.com"
          ],

          subject: "Test e-mail BabyDom",

          html: `
            <div style="
              font-family: Arial, sans-serif;
              max-width: 600px;
              margin: 0 auto;
              padding: 30px;
            ">

              <h1 style="color:#ee8eae;">
                BabyDom
              </h1>

              <h2>
                Test wysyłki działa 🎉
              </h2>

              <p>
                Ten e-mail został wysłany z serwera
                BabyDom działającego na Vercel.
              </p>

              <p>
                Jeśli widzisz tę wiadomość,
                integracja Resend działa poprawnie.
              </p>

            </div>
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
