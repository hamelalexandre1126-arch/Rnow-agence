const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST requis' });

  const { type, depart, destination, budget, style, date, duree, isRealSearch, ancienItineraire, feedback } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) return res.status(500).json({ text: "Clé API manquante." });

  // --- LE PROMPT RNOW PREMIUM (REPRIS DE TA FORME ORIGINALE) ---
  const instructionsRnow = `
Tu es l'Expert-Concierge de Rnow. Ton ton est jeune, ultra-dynamique, luxueux et pro.
IMPORTANT : Ne mets JAMAIS d'astérisques (*), de dièses (#) ou de gras. Utilise uniquement des MAJUSCULES pour les titres. Saute une ligne entre chaque puce.

STRUCTURE DE RÉPONSE :

1. ACCUEIL : Salue le client avec l'énergie Rnow.
2. ANALYSE EXPERTE : Un paragraphe de 4-5 lignes qui analyse le combo (Destination: ${destination}, Budget: ${budget}€, Style: ${style}). Montre au client que tu as compris ses attentes.

POUR CHAQUE JOUR (JOUR 1, JOUR 2, etc.) :
------------------------------------------
TITRE : JOUR X - [NOM DE L'ÉTAPE]
Une phrase courte qui résume l'ambiance de la journée.

📍 L'ACTIVITÉ RNOW : [Nom précis de l'activité]. Détaille ici pourquoi c'est génial et ce qu'il va vivre.
💰 RÉSERVATION : S'il faut réserver, mets [Réserver l'activité](Lien). Sinon, écris "Accès libre / Pas de réservation nécessaire".

🏠 TON REFUGE : [Nom de l'hôtel/logement]. Explique l'atout unique du lieu et son adresse.
💰 RÉSERVATION : [Réserver cet hôtel](Lien).

🍴 LA TABLE RNOW : [Nom du restaurant]. Décris le plat signature et l'ambiance.
💰 RÉSERVATION : [Réserver une table](Lien) (si applicable).

🚕 TRANSPORT : Détaille ici les trajets du jour (Mode, Temps, Coût estimé).

------------------------------------------

5. LOGISTIQUE GLOBALE : Vols A/R, Assurances et Location de véhicule.
6. LE CONSEIL D'INITIÉ : Un secret de local pour rendre le voyage inoubliable.

CONSIGNES LIENS :
- Vols : [Réserver mon vol](https://www.skyscanner.fr/transport/vols/${depart}/${destination}/${date})
- Hôtels : [Réserver cet hôtel](https://www.booking.com/searchresults.html?ss=NOM_HOTEL+${destination})
- Activités : [Réserver l'activité](https://www.getyourguide.fr/s/?q=NOM_ACTIVITE)
- SI PAS DE RÉSERVATION : Ne mets pas de lien.
  `;

  let promptFinal = "";

  if (isRealSearch) {
    promptFinal = `TRANSFORMATION RÉELLE : Reprends cet itinéraire : "${ancienItineraire}".
    Remplace toutes les estimations par des conseils PRÉCIS (Noms d'hôtels et restos réels) et génère les liens cliquables correspondants.
    ${instructionsRnow}`;
  } else if (type === "initial") {
    promptFinal = `SIMULATION INITIALE : Crée le voyage de rêve pour ${destination} (${duree} jours) dès le ${date}. 
    Utilise tes connaissances pour proposer des lieux iconiques. Mets des [Estimations] pour les prix.
    ${instructionsRnow}`;
  } else {
    promptFinal = `MODIFICATION : Applique ce changement "${feedback}" à l'itinéraire suivant : "${ancienItineraire}". 
    ${instructionsRnow}`;
  }

  try {
    // --- DÉTECTION DYNAMIQUE DU MODÈLE ---
    const listResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const listData = await listResponse.json();
    let selectedModel = listData.models?.find(m => m.name.includes("flash")) || listData.models?.[0];

    if (!selectedModel) throw new Error("Aucun modèle trouvé.");

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/${selectedModel.name}:generateContent?key=${apiKey}`;

    const bodyPayload = {
      contents: [{ parts: [{ text: promptFinal }] }],
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" }
      ]
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload)
    });

    const data = await response.json();

    if (data.error) return res.status(200).json({ text: "Erreur : " + data.error.message });

    let textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text || "Erreur de génération.";
    
    // Nettoyage Markdown (on garde le format [Texte](Lien) pour que ton HTML le transforme en bleu)
    textOutput = textOutput.replace(/\*\*/g, '').replace(/\*/g, '').replace(/#/g, '');

    res.status(200).json({ text: textOutput });

  } catch (error) {
    res.status(500).json({ text: "Erreur serveur : " + error.message });
  }
}
