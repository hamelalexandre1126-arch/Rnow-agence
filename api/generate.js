const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST requis' });

  const { type, depart, destination, budget, confort, style, date, duree, ancienItineraire, feedback } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(200).json({ text: "Erreur : La clé GEMINI_API_KEY n'est pas configurée sur Vercel." });
  }

  const instructionsRnow = `
Tu es l'Expert-Concierge de Rnow. Ton ton est dynamique, moderne et professionnel.
Génère le carnet complet avec cette structure précise :

1. ACCUEIL ET ANALYSE EXPERTE : Analyse le budget (${budget}€ pour ${duree} jours en mode ${confort}) et les envies : ${style || 'Découverte'}.
2. TRANSPORTS GLOBAUX : Vols ou trains A/R depuis ${depart || 'Paris'} vers ${destination}. Lien : [Réserver mon transport](https://www.skyscanner.fr/transport/vols/${depart || 'PAR'}/${destination}/${date || '2026-06-01'})
3. HÉBERGEMENTS : Liste les établissements par ville. Lien : [Réserver cet hôtel](https://www.booking.com/searchresults.html?ss=HOTEL+${destination})
4. GASTRONOMIE : Bonnes adresses et pépites locales triées par ville.
5. DÉTAIL JOUR PAR JOUR (Du Jour 1 au Jour ${duree}) :
- Pour chaque jour :
📍 ACTIVITÉ : Ce qu'on fait (en lien avec les envies).
💰 RÉSERVATION : [Réserver l'activité](https://www.getyourguide.fr/s/?q=ACTIVITE+${destination}) ou "Accès libre".
🚕 LOGISTIQUE LOCALE : Moyens de transport du jour (Collectivos, Taxi, Bus, Marche).
6. CONSEILS PRATIQUES & INITIÉS.

RÈGLES D'ÉCRITURE : Majuscule en début de chaque phrase. Pas d'astérisques (*), pas de dièses (#), pas de gras (**). Saute des lignes entre les rubriques.
  `;

  let promptFinal = "";
  if (type === "initial") {
    promptFinal = `Génère un itinéraire complet et détaillé de ${duree} jours à ${destination}. ${instructionsRnow}`;
  } else {
    promptFinal = `Prends cet itinéraire : "${ancienItineraire}". Modifie-le selon ce feedback : "${feedback}". ${instructionsRnow}`;
  }

  try {
    // 1. Détection dynamique du modèle actif pour éviter l'erreur "Model Not Found"
    const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const listData = await listRes.json();

    if (listData.error) {
      return res.status(200).json({ text: "Erreur Google API : " + listData.error.message });
    }

    // Sélectionne un modèle de génération valide (flash ou pro)
    const validModel = listData.models?.find(m => 
      m.supportedGenerationMethods?.includes("generateContent") && 
      (m.name.includes("flash") || m.name.includes("gemini"))
    ) || listData.models?.[0];

    if (!validModel) {
      return res.status(200).json({ text: "Aucun modèle Gemini disponible sur ce compte Google AI Studio." });
    }

    // 2. Appel du modèle sélectionné
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/${validModel.name}:generateContent?key=${apiKey}`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptFinal }] }],
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" }
        ],
        generationConfig: { temperature: 0.75, maxOutputTokens: 3800 }
      })
    });

    const data = await response.json();

    if (data.error) {
      return res.status(200).json({ text: "Erreur lors de la génération : " + data.error.message });
    }

    let textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textOutput) {
      return res.status(200).json({ text: "L'IA a retourné une réponse vide. Veuillez réessayer." });
    }

    // Nettoyage Markdown
    textOutput = textOutput.replace(/\*\*/g, '').replace(/\*/g, '').replace(/#/g, '');

    res.status(200).json({ text: textOutput });

  } catch (error) {
    res.status(200).json({ text: "Erreur serveur : " + error.message });
  }
}
