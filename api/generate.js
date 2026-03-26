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
Tu es un agent professionnel d’une agence de voyage spécialisée dans l’organisation de séjours sur mesure nommée Rnow.
Ta mission est de concevoir un voyage complet pour : ${destination}.

1. Utilisation des informations : Destination: ${destination}, Budget: ${budget}€, Style: ${style}, Date: ${date}, Durée: ${duree} jours, Hébergement: ${hebergement}.
2. Organisation de A à Z : transports, logements, activités, restauration, assurances, conseils.
3. Prix RÉELS et vérifiés sur internet pour les dates du ${date}.
4. Programme JOUR PAR JOUR HYPER DÉTAILLÉ avec horaires.
5. Activités : nom précis, description, adresse, prix, durée, accès, site officiel.
6. Transports locaux : mode, lieu, prix, fiabilité.
7. Hébergement : nom, adresse, prix/nuit, type de chambre.
8. Restaurants : 1 restaurant AUTHENTIQUE par jour (pas d'attrape-touriste).
9. Assurance voyage : plusieurs options précises.
10. Location voiture : si pertinente (compagnie, prix).
11. Niveau de détail : programme clé en main.

RÈGLES : Pas de tableaux. Écris beaucoup. Finis par "Mes conseils voyages".
  `;

  try {
    // --- CHANGEMENT CRUCIAL : v1 AU LIEU DE v1beta + gemini-pro ---
    const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptFinal }] }]
      })
    });

    const data = await response.json();

    if (data.error) {
      return res.status(500).json({ text: "Erreur Google (" + data.error.code + ") : " + data.error.message });
    }

    if (!data.candidates || !data.candidates[0].content) {
      return res.status(500).json({ text: "L'IA n'a pas pu répondre. Vérifie ta destination." });
    }

    const textOutput = data.candidates[0].content.parts[0].text;
    res.status(200).json({ text: textOutput });

  } catch (error) {
    res.status(500).json({ text: "Erreur technique : " + error.message });
  }
}
