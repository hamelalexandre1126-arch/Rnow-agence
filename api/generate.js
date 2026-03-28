const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST requis' });

  const { type, depart, destination, budget, style, date, duree, isRealSearch, ancienItineraire, feedback } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) return res.status(500).json({ text: "Clé API manquante." });

  // On verrouille les 11 points et le style Rnow
  const instructionsRnow = `
Ton ton est jeune, dynamique et expert.
STRUCTURE STRICTE (11 POINTS) :
1. ACCUEIL Rnow énergique.
2. ANALYSE EXPERTE (4 lignes) Destination/Budget/Style.
3. PROGRAMME RÉSUMÉ jour par jour.
4. DÉTAILS CHIRURGICAUX (📍 ACTIVITÉ, 💰 RÉSERVATION, 🏠 REFUGE, 🍴 TABLE, 🚕 TRANSPORT).
5. LOGISTIQUE : Vols, Assurances, Location.
6. CONSEIL D'INITIÉ.
RÈGLES : Date DD/MM/YYYY, une ligne d'espace entre chaque point, UN emoji varié par ligne (pas de répétition), ZERO symbole (* ou #). Budget total : ${budget}€.
  `;

  let promptFinal = "";

  if (isRealSearch) {
    // Mode recherche ciblée pour éviter le timeout
    promptFinal = `UTILISE LA RECHERCHE GOOGLE pour trouver UNIQUEMENT les prix et liens officiels de cet itinéraire : "${ancienItineraire}".
    Sois ultra-rapide et concis sur les liens. ${instructionsRnow}`;
  } else if (type === "initial") {
    // Mode simulation ultra-rapide (SANS WEB)
    promptFinal = `Génère une simulation de voyage EXPERTE de ${depart} vers ${destination} (${duree} jours) le ${date}. 
    Budget: ${budget}€, Style: ${style}. Ne fais pas de recherche web, utilise tes connaissances pour répondre instantanément.
    ${instructionsRnow}`;
  } else {
    // Mode modification
    promptFinal = `Modifie cette simulation selon le feedback "${feedback}" : "${ancienItineraire}". 
    Réponds instantanément sans recherche web. ${instructionsRnow}`;
  }

  try {
    const modelName = "gemini-1.5-flash"; // Le plus rapide

    const bodyPayload = {
      contents: [{ parts: [{ text: promptFinal }] }],
      safetySettings: [{ category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }]
    };

    // On n'active le moteur Google QUE si c'est la recherche réelle demandée par le bouton noir
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
      // Message de secours si Google est trop lent
      return res.status(200).json({ text: "L'expert Rnow a finalisé votre plan ! Cliquez sur le bouton de recherche réelle pour obtenir les derniers liens de réservation à jour. ✨" });
    }

    let textOutput = data.candidates[0].content.parts[0].text;
    textOutput = textOutput.replace(/\*\*/g, '').replace(/\*/g, '').replace(/#/g, '');

    res.status(200).json({ text: textOutput });
  } catch (error) {
    res.status(500).json({ text: "Erreur technique Rnow. Réessayez !" });
  }
}
