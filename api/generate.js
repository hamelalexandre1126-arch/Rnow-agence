const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST requis' });

  const { type, depart, destination, budget, style, date, duree, isRealSearch, ancienItineraire, feedback } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) return res.status(500).json({ text: "Clé API manquante." });

  const instructionsRnow = `
Ton ton est jeune, dynamique et expert. 
STRUCTURE STRICTE (11 POINTS) :
1. ACCUEIL Rnow.
2. ANALYSE EXPERTE (4 lignes) sur le combo Destination/Budget/Style.
3. PROGRAMME RÉSUMÉ jour par jour.
4. DÉTAILS CHIRURGICAUX (📍 ACTIVITÉ, 💰 PRIX/LIEN, 🏠 REFUGE, 🍴 TABLE, 🚕 TRANSPORT).
5. LOGISTIQUE : Vols, Assurances, Location.
6. CONSEIL D'INITIÉ.
RÈGLES : Date DD/MM/YYYY, une ligne d'espace entre chaque puce, UN emoji varié par ligne, ZERO symbole (* ou #). Budget : ${budget}€.
  `;

  let promptFinal = "";

  if (isRealSearch) {
    // ICI ON GARDE TOUT L'ITINÉRAIRE MAIS ON REMPLACE LES ESTIMATIONS PAR DES LIENS RÉELS
    promptFinal = `Tu es l'Expert Rnow. REPRENDS EXACTEMENT cet itinéraire : "${ancienItineraire}". 
    UTILISE LA RECHERCHE GOOGLE pour trouver les LIENS RÉELS de réservation et les PRIX EXACTS du jour. 
    Réécris l'itinéraire en entier avec ces liens cliquables. ${instructionsRnow}`;
  } else if (type === "initial") {
    // ICI ON GÉNÈRE L'ITINÉRAIRE COMPLET SANS ATTENDRE LE WEB
    promptFinal = `Tu es l'Expert Rnow. GÉNÈRE UN ITINÉRAIRE DÉTAILLÉ DE A à Z pour ${destination} pendant ${duree} jours. 
    Utilise tes connaissances (sans recherche web pour être instantané). 
    Pour les prix et liens, mets des ESTIMATIONS réalistes (ex: [Site officiel - Estimation 50€]).
    ${instructionsRnow}`;
  } else {
    promptFinal = `Modifie cet itinéraire selon le feedback "${feedback}" : "${ancienItineraire}". ${instructionsRnow}`;
  }

  try {
    const modelName = "gemini-1.5-flash";
    const bodyPayload = {
      contents: [{ parts: [{ text: promptFinal }] }],
      safetySettings: [{ category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }]
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
    
    // Si l'IA bug, on lui demande de renvoyer au moins un texte
    let textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text || "L'expert Rnow a rencontré un petit souci. Réessaie de générer !";
    
    textOutput = textOutput.replace(/\*\*/g, '').replace(/\*/g, '').replace(/#/g, '');

    res.status(200).json({ text: textOutput });
  } catch (error) {
    res.status(500).json({ text: "Erreur technique : " + error.message });
  }
}
