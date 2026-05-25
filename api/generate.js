const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST requis' });

  const { type, depart, destination, budget, confort, style, date, duree, ancienItineraire, feedback } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) return res.status(500).json({ text: "Clé API manquante." });

  const instructionsRnow = `
Tu es l'Expert-Concierge de Rnow. Ton ton est dynamique et professionnel. 
Tu dois organiser le carnet de voyage avec cette structure thématique précise :

1. ACCUEIL ET ANALYSE : Salue et analyse le budget (${budget}€ pour ${duree} jours en mode ${confort}). Prend bien en compte les envies du client : ${style}.

2. TRANSPORTS GLOBAUX : Détaille les vols, trains ou bus longue distance pour l'aller et le retour.
💰 RÉSERVATION : [Réserver le transport](https://www.skyscanner.fr/transport/vols/${depart}/${destination}/${date})

3. HÉBERGEMENTS : Liste tous les hébergements suggérés pour tout le séjour. Si plusieurs destinations/étapes, classe-les par ville.
💰 RÉSERVATION : [Réserver cet hôtel](https://www.booking.com/searchresults.html?ss=HOTEL+${destination})

4. RESTAURANTS ET GASTRONOMIE : Une liste des meilleures adresses (bon rapport qualité/prix) classées par ville. Ne le fais plus jour par jour.

5. DÉTAIL JOUR PAR JOUR (Focus Activités et Logistique locale) :
Pour chaque jour (JOUR 1 à ${duree}) :
📍 ACTIVITÉ : Détaille l'expérience principale en lien avec : ${style}.
💰 RÉSERVATION : [Réserver l'activité](https://www.getyourguide.fr/s/?q=ACTIVITE+${destination}) ou "Accès libre".
🚕 LOGISTIQUE JOURNÉE : Précise comment circuler ce jour-là (Uber, Collectivos, Tuk-tuk, navette, etc.).

6. LOGISTIQUE FINALE : Assurances et conseils pratiques.

RÈGLES D'ÉCRITURE : Majuscule au début de chaque phrase. Pas de gras (**), pas de dièses (#). Saute des lignes entre les rubriques.
  `;

  let promptFinal = "";
  if (type === "initial") {
    promptFinal = `Génère un itinéraire COMPLET et détaillé de ${duree} jours à ${destination}. ${instructionsRnow}`;
  } else {
    promptFinal = `Prends cet itinéraire : "${ancienItineraire}". Modifie-le selon ce feedback : "${feedback}". ${instructionsRnow}`;
  }

  try {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

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
        generationConfig: { temperature: 0.8, maxOutputTokens: 3800 }
      })
    });

    const data = await response.json();
    let textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text || "Erreur de génération.";
    
    textOutput = textOutput.replace(/\*\*/g, '').replace(/\*/g, '').replace(/#/g, '');
    
    res.status(200).json({ text: textOutput });
  } catch (error) {
    res.status(500).json({ text: "Erreur technique serveur." });
  }
}
