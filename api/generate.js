const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST requis' });

  const { type, depart, destination, budget, style, date, duree, isRealSearch, ancienItineraire, feedback } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) return res.status(500).json({ text: "Clé API manquante." });

  const instructionsRnow = `
Ton ton est jeune, dynamique et expert. 
STRUCTURE STRICTE (11 POINTS) :
1. ACCUEIL Rnow énergique.
2. ANALYSE EXPERTE (4 lignes).
3. PROGRAMME RÉSUMÉ J/J.
4. DÉTAILS CHIRURGICAUX (📍 ACTIVITÉ, 💰 RÉSERVATION, 🏠 REFUGE, 🍴 TABLE, 🚕 TRANSPORT).
5. LOGISTIQUE : Vols, Assurances, Location.
6. CONSEIL D'INITIÉ.
RÈGLES : Date DD/MM/YYYY, une ligne d'espace entre chaque puce, UN emoji varié par ligne, ZERO symbole (* ou #).
  `;

  let promptFinal = "";

  if (isRealSearch) {
    promptFinal = `Tu es l'Expert Rnow. REPRENDS cet itinéraire : "${ancienItineraire}".
    Pour chaque activité, hôtel ou vol, crée un LIEN DE RECHERCHE RÉEL et CLICQUABLE.
    FORMATS OBLIGATOIRES :
    - Vols : https://www.skyscanner.fr/transport/vols/${depart}/${destination}/${date}
    - Hôtels : https://www.booking.com/searchresults.html?ss=${destination}&checkin=${date}
    - Activités : https://www.getyourguide.fr/s/?q=${destination}
    Réécris l'itinéraire complet avec ces liens dans la section 💰 RÉSERVATION. ${instructionsRnow}`;
  } else if (type === "initial") {
    promptFinal = `Génère un itinéraire complet pour ${destination} (${duree} jours) le ${date}. 
    Budget: ${budget}€. Ne fais pas de recherche web pour répondre instantanément.
    Pour les prix, mets des ESTIMATIONS (ex: [Estimation 50€]).
    ${instructionsRnow}`;
  } else {
    promptFinal = `Modifie selon le feedback "${feedback}" : "${ancienItineraire}". ${instructionsRnow}`;
  }

  try {
    // --- 🔍 SOLUTION DE DÉTECTION DYNAMIQUE DU MODÈLE (Celle qui marche !) ---
    const listResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const listData = await listResponse.json();
    
    // On cherche le meilleur modèle dispo (Flash en priorité, sinon le premier de la liste)
    let selectedModel = listData.models?.find(m => m.name.includes("flash")) || listData.models?.[0];

    if (!selectedModel) throw new Error("Aucun modèle IA détecté sur ce compte.");

    const bodyPayload = {
      contents: [{ parts: [{ text: promptFinal }] }],
      safetySettings: [{ category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }]
    };

    // On appelle l'API avec le nom de modèle détecté dynamiquement
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${selectedModel.name}:generateContent?key=${apiKey}`, {
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
