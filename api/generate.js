const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST requis' });

  const { type, depart, destination, budget, style, date, duree, isRealSearch, ancienItineraire, feedback } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) return res.status(500).json({ text: "Clé API manquante." });

  // Prompt allégé pour la rapidité
  const instructionsRnow = `
Ton ton est jeune et dynamique.
STRUCTURE (11 POINTS) : Accueil, Analyse (4 lignes), Résumé, Détails (📍 Activité, 💰 Prix/Lien, 🏠 Refuge, 🍴 Table, 🚕 Transport), Logistique, Conseil.
DATES : DD/MM/YYYY. ESPACE : Une ligne entre chaque puce. EMOJIS : Un seul, varié. ZERO SYMBOLE (* ou #). BUDGET : ${budget}€.
  `;

  let promptFinal = "";

  if (isRealSearch) {
    // On limite la recherche pour gagner du temps et éviter le timeout Vercel
    promptFinal = `RECHERCHE GOOGLE RAPIDE : Trouve UNIQUEMENT les 3 liens officiels et prix réels prioritaires pour cet itinéraire : "${ancienItineraire}". Complète le reste par des estimations.
    ${instructionsRnow}`;
  } else if (type === "initial") {
    promptFinal = `SIMULATION RAPIDE (Sans recherche web). Paramètres : ${depart} vers ${destination}, Budget: ${budget}€, Style: ${style}, Date: ${date}, ${duree} jours.
    ${instructionsRnow}`;
  } else {
    promptFinal = `Modifie cette simulation : "${ancienItineraire}" selon : "${feedback}".
    ${instructionsRnow}`;
  }

  try {
    // Utilisation directe de gemini-1.5-flash (le plus rapide du monde actuellement)
    const modelName = "gemini-1.5-flash"; 

    const bodyPayload = {
      contents: [{ parts: [{ text: promptFinal }] }],
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
      ]
    };

    if (isRealSearch) {
      bodyPayload.tools = [{ google_search_retrieval: {} }];
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload)
    });

    const data = await response.json();
    
    if (!data.candidates || !data.candidates[0]) {
      return res.status(200).json({ text: "Le scan web est un peu lent. Réessayez une fois, les résultats sont en cache !" });
    }

    let textOutput = data.candidates[0].content.parts[0].text;
    textOutput = textOutput.replace(/\*\*/g, '').replace(/\*/g, '').replace(/#/g, '');

    res.status(200).json({ text: textOutput });
  } catch (error) {
    res.status(500).json({ text: "Erreur Rnow : " + error.message });
  }
}
