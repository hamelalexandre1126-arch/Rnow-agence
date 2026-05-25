const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST requis' });

  const { type, depart, destination, budget, confort, style, date, duree, isRealSearch, ancienItineraire, feedback } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) return res.status(500).json({ text: "Clé API manquante." });

  const instructionsRnow = `
Tu es l'Expert-Concierge de Rnow. Ton ton est dynamique et professionnel. 
Tu dois organiser le carnet de voyage avec cette structure précise :

1. ACCUEIL ET ANALYSE : Salue et analyse le budget (${budget}€ pour ${duree} jours en mode ${confort}). Mentionne les envies du client : ${style}.

2. TRANSPORTS GLOBAUX : Détaille les vols, trains ou bus longue distance pour l'aller et le retour.
💰 RÉSERVATION : [Lien Skyscanner/Omio](Lien)

3. HÉBERGEMENTS : Liste tous les hébergements suggérés pour tout le séjour. Si plusieurs étapes, classe-les par destination.
💰 RÉSERVATION : [Lien Booking](Lien)

4. RESTAURANTS ET GASTRONOMIE : Une liste des meilleures adresses (bon rapport qualité/prix) classées par destination. Ne le fais plus jour par jour.

5. DÉTAIL JOUR PAR JOUR :
Pour chaque jour (JOUR 1 à ${duree}) :
📍 ACTIVITÉ : Détaille ce qu'on fait (en lien avec les envies : ${style}).
💰 RÉSERVATION : [Lien GetYourGuide](Lien) (si besoin, sinon "Accès libre").
🚕 LOGISTIQUE JOURNÉE : Précise les transports internes (Uber, Collectivos, Tuk-tuk, location, etc.).

6. LOGISTIQUE FINALE : Assurances et conseils pratiques.

CONSIGNES LIENS :
- Hébergements : https://www.booking.com/searchresults.html?ss=NOM_HOTEL+${destination}
- Activités : https://www.getyourguide.fr/s/?q=NOM_ACTIVITE
- Vols : https://www.skyscanner.fr/transport/vols/${depart}/${destination}/${date}

RÈGLES D'ÉCRITURE : Majuscule au début de chaque phrase. Pas de gras (**), pas de dièses (#).
  `;

  let promptFinal = "";
  if (type === "initial") {
    promptFinal = `Génère un voyage complet de ${duree} jours à ${destination}. ${instructionsRnow}`;
  } else {
    promptFinal = `Prends cet itinéraire : "${ancienItineraire}". Applique ces changements : "${feedback}". ${instructionsRnow}`;
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
        generationConfig: { temperature: 0.75, maxOutputTokens: 3500 }
      })
    });

    const data = await response.json();
    let textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text || "Erreur de génération.";
    
    // Nettoyage Markdown
    textOutput = textOutput.replace(/\*\*/g, '').replace(/\*/g, '').replace(/#/g, '');
    
    res.status(200).json({ text: textOutput });
  } catch (error) {
    res.status(500).json({ text: "Erreur technique." });
  }
}
