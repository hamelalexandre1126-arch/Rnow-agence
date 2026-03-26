const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const { destination, budget, style, date, duree, hebergement } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ text: "Erreur : La clé API est manquante dans Vercel." });
  }

  const promptFinal = `
Tu es un agent professionnel de l'agence Rnow.
Crée un voyage complet pour : ${destination}.
Dates : dès le ${date} pour ${duree} jours.
Budget : ${budget}€.
Style : ${style}.
Hébergement : ${hebergement}.

REPECTE CES 11 POINTS :
1. Infos précises uniquement.
2. Organisation A à Z.
3. Prix RÉELS et vérifiés.
4. Programme JOUR PAR JOUR détaillé.
5. Activités avec adresses et prix.
6. Transports locaux détaillés.
7. Hébergement précis.
8. 1 resto authentique/jour.
9. Options d'assurances.
10. Location voiture si besoin.
11. Détails Clé en main.

RÈGLES : Pas de tableaux. Écris beaucoup. Finis par "Mes conseils voyages".
  `;

  try {
    // UTILISATION DU MODÈLE LE PLUS STABLE POUR LE MEXIQUE / USA
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptFinal }] }]
      })
    });

    const data = await response.json();

    if (data.error) {
      // Si ça ne marche toujours pas, on essaie le modèle de secours immédiat
      return res.status(500).json({ text: "Erreur Google (" + data.error.code + ") : " + data.error.message });
    }

    const textOutput = data.candidates[0].content.parts[0].text;
    res.status(200).json({ text: textOutput });

  } catch (error) {
    res.status(500).json({ text: "Erreur technique : " + error.message });
  }
}
