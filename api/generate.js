const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const { destination, budget, style, date, duree, hebergement } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ text: "Erreur : La clé API est manquante." });
  }

  const promptFinal = `Tu es l'agent Rnow. Crée un voyage pour ${destination} (${duree} jours) dès le ${date}. Budget: ${budget}€. Style: ${style}. Hébergement: ${hebergement}. Détaille tout (vols, hôtels, activités, restos) selon mes 11 points précis. Pas de tableaux.`;

  try {
    // --- L'URL LA PLUS COMPATIBLE AU MONDE ---
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptFinal }] }]
      })
    });

    const data = await response.json();

    // SI CA NE MARCHE PAS, ON RENVOIE L'ERREUR POUR COMPRENDRE
    if (data.error) {
      return res.status(500).json({ text: "Erreur Google : " + data.error.message + " (Code: " + data.error.status + ")" });
    }

    const textOutput = data.candidates[0].content.parts[0].text;
    res.status(200).json({ text: textOutput });

  } catch (error) {
    res.status(500).json({ text: "Erreur technique : " + error.message });
  }
}
