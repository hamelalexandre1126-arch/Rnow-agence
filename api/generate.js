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
2. ANALYSE EXPERTE (4 lignes).
3. PROGRAMME RÉSUMÉ.
4. DÉTAILS CHIRURGICAUX (📍 ACTIVITÉ, 💰 RÉSERVATION, 🏠 REFUGE, 🍴 TABLE, 🚕 TRANSPORT).
5. LOGISTIQUE : Vols, Assurances, Location.
6. CONSEIL D'INITIÉ.
RÈGLES : Date DD/MM/YYYY, une ligne d'espace entre chaque puce, UN emoji varié, ZERO symbole (* ou #).
  `;

  let promptFinal = "";

  if (isRealSearch) {
    // STRATÉGIE "DEEP LINKS" : On transforme l'itinéraire en version avec liens cliquables
    promptFinal = `Tu es l'Expert Rnow. REPRENDS cet itinéraire : "${ancienItineraire}".
    Pour chaque activité, hôtel ou vol, crée un LIEN DE RECHERCHE RÉEL.
    EXEMPLES DE FORMATS À UTILISER :
    - Vols : https://www.skyscanner.fr/transport/vols/${depart}/${destination}/${date}
    - Hôtels : https://www.booking.com/searchresults.html?ss=${destination}&checkin=${date}
    - Activités : https://www.getyourguide.fr/s/?q=${destination}
    
    Réécris l'itinéraire complet en intégrant ces liens dans la section 💰 RÉSERVATION. ${instructionsRnow}`;
  } else if (type === "initial") {
    // SIMULATION INSTANTANÉE
    promptFinal = `Génère un itinéraire complet pour ${destination} (${duree} jours) le ${date}. 
    Budget: ${budget}€. Ne fais pas de recherche web. 
    Pour les prix, mets des ESTIMATIONS (ex: [Estimation 50€]).
    ${instructionsRnow}`;
  } else {
    promptFinal = `Modifie selon le feedback "${feedback}" : "${ancienItineraire}". ${instructionsRnow}`;
  }

  try {
    const modelName = "gemini-1.5-flash"; 
    const bodyPayload = {
      contents: [{ parts: [{ text: promptFinal }] }],
      safetySettings: [{ category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }]
    };

    // ON DÉSACTIVE GOOGLE SEARCH RETRIEVAL (Trop lent / Cause des timeouts)
    // L'IA utilise sa propre logique pour construire les liens de recherche.

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload)
    });

    const data = await response.json();
    let textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text || "Erreur de génération.";
    
    textOutput = textOutput.replace(/\*\*/g, '').replace(/\*/g, '').replace(/#/g, '');

    res.status(200).json({ text: textOutput });
  } catch (error) {
    res.status(500).json({ text: "Erreur technique : " + error.message });
  }
}
