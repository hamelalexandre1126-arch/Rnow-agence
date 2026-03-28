const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST requis' });

  const { type, depart, destination, budget, confort, style, date, duree, isRealSearch, ancienItineraire, feedback } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) return res.status(500).json({ text: "Clé API manquante." });

  const instructionsRnow = `
Tu es l'Expert-Concierge de Rnow. Ton ton est dynamique et moderne, mais reste strictement professionnel.

IMPORTANT : 
- Ne mets JAMAIS d'astérisques (*), de dièses (#) ou de gras (**).
- N'écris JAMAIS en majuscules (sauf pour les titres de rubriques cités ci-dessous).
- Saute une ligne entre chaque puce.

STRUCTURE DE RÉPONSE :

1. ACCUEIL : Salue le client avec élégance.
2. ANALYSE EXPERTE : Un paragraphe de 4-5 lignes (en minuscules) analysant la faisabilité du voyage (destination: ${destination}, budget: ${budget}€, confort: ${confort}). Explique comment tu optimises le budget de ${Math.round(budget/duree)}€/jour.

POUR CHAQUE JOUR :
------------------------------------------
TITRE : JOUR X - [Nom de l'étape]
Une courte phrase d'introduction en minuscules.

📍 L'ACTIVITÉ RNOW : [Nom]. Description détaillée de l'expérience (en minuscules).
💰 RÉSERVATION : S'il faut réserver, [Réserver l'activité](Lien). Sinon, "Accès libre".

🏠 TON REFUGE : [Nom]. Pourquoi ce choix selon le niveau de confort ${confort} (en minuscules).
💰 RÉSERVATION : [Réserver cet hôtel](Lien).

🍴 LA TABLE RNOW : [Nom]. Conseil gastronomique adapté au budget (en minuscules).
💰 RÉSERVATION : [Réserver une table](Lien) (si applicable).

🚕 TRANSPORT : Détails logistiques (mode, temps, coût estimé) en minuscules.

------------------------------------------

5. LOGISTIQUE GLOBALE : Vols A/R, assurances et location.
6. LE CONSEIL D'INITIÉ : Un secret de local en minuscules pour sublimer le séjour.

CONSIGNES LIENS :
- Vols : [Réserver mon vol](https://www.skyscanner.fr/transport/vols/${depart}/${destination}/${date})
- Hôtels : [Réserver cet hôtel](https://www.booking.com/searchresults.html?ss=NOM_HOTEL+${destination})
- Activités : [Réserver l'activité](https://www.getyourguide.fr/s/?q=NOM_ACTIVITE)
- Si pas de réservation nécessaire, ne mets aucun lien.
  `;

  let promptFinal = "";

  if (isRealSearch) {
    promptFinal = `TRANSFORMATION RÉELLE : Reprends cet itinéraire : "${ancienItineraire}". Propose des noms réels adaptés au budget de ${budget}€ et au confort ${confort}. Tout le texte doit être en minuscules. ${instructionsRnow}`;
  } else if (type === "initial") {
    promptFinal = `SIMULATION INITIALE : Crée un voyage de ${duree} jours à ${destination}. Budget: ${budget}€, Confort: ${confort}. Tout le texte doit être en minuscules. ${instructionsRnow}`;
  } else {
    promptFinal = `MODIFICATION : "${feedback}" sur : "${ancienItineraire}". Tout le texte doit être en minuscules. ${instructionsRnow}`;
  }

  try {
    const listResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const listData = await listResponse.json();
    let selectedModel = listData.models?.find(m => m.name.includes("flash")) || listData.models?.[0];
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/${selectedModel.name}:generateContent?key=${apiKey}`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptFinal }] }],
        safetySettings: [{ category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }]
      })
    });

    const data = await response.json();
    let textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text || "Erreur de génération.";
    textOutput = textOutput.replace(/\*\*/g, '').replace(/\*/g, '').replace(/#/g, '');
    res.status(200).json({ text: textOutput });
  } catch (error) {
    res.status(500).json({ text: "Erreur technique." });
  }
}
