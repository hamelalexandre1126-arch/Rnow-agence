const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST requis' });

  const { type, depart, destination, budget, confort, style, date, duree, isRealSearch, ancienItineraire, feedback } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) return res.status(500).json({ text: "Clé API manquante." });

  const instructionsRnow = `
Tu es l'Expert-Concierge de Rnow. Ton ton est dynamique, moderne et strictement professionnel.

RÈGLES D'ÉCRITURE :
- Utilise une PONCTUATION PARFAITE (Majuscule en début de chaque phrase).
- Ne mets JAMAIS tout un paragraphe ou toute une phrase en MAJUSCULES.
- Pas d'astérisques (*), pas de dièses (#), pas de gras (**).
- Saute une ligne entre chaque puce.

STRUCTURE DE RÉPONSE :
1. ACCUEIL : Salue le client avec élégance.
2. ANALYSE EXPERTE : Paragraphe de 4-5 lignes analysant la faisabilité (Destination: ${destination}, Budget: ${budget}€, Confort: ${confort}). Explique l'optimisation de ${Math.round(budget/duree)}€/jour.

POUR CHAQUE JOUR :
------------------------------------------
TITRE : JOUR X - [Nom de l'étape en majuscules simples]
Une phrase d'introduction soignée.

📍 L'ACTIVITÉ : [Nom]. Détaille l'expérience.
💰 RÉSERVATION : [Réserver l'activité](Lien) ou "Accès libre".

🏠 TON REFUGE RNOW : [Nom]. Pourquoi ce choix pour le confort ${confort}.
💰 RÉSERVATION : [Réserver cet hôtel](Lien).

🍴 LA TABLE RNOW : [Nom]. Conseil gastronomique.
💰 RÉSERVATION : [Réserver une table](Lien) (si applicable).

🚕 TRANSPORT : Détails logistiques (Mode, Temps, Coût).

------------------------------------------
5. LOGISTIQUE GLOBALE : Vols A/R ou train en fonction du voyage, Assurances et Location.
6. LE CONSEIL D'INITIÉ : Secret de local.

CONSIGNES LIENS :
- Vols : [Réserver mon vol](https://www.skyscanner.fr/transport/vols/${depart}/${destination}/${date})
- Hôtels : [Réserver cet hôtel](https://www.booking.com/searchresults.html?ss=NOM_HOTEL+${destination})
- Activités : [Réserver l'activité](https://www.getyourguide.fr/s/?q=NOM_ACTIVITE)
  `;

  let promptFinal = "";
  if (type === "initial") {
    promptFinal = `Génère un voyage de ${duree} jours à ${destination}. Budget: ${budget}€, Confort: ${confort}. ${instructionsRnow}`;
  } else {
    promptFinal = `Modifie cet itinéraire : "${ancienItineraire}" selon le feedback : "${feedback}". ${instructionsRnow}`;
  }

  try {
    const listResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const listData = await listResponse.json();
    let selectedModel = listData.models?.find(m => m.name.includes("flash")) || listData.models?.[0];

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${selectedModel.name}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptFinal }] }],
        safetySettings: [{ category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
      })
    });

    const data = await response.json();
    let textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text || "Erreur.";
    textOutput = textOutput.replace(/\*\*/g, '').replace(/\*/g, '').replace(/#/g, '');
    res.status(200).json({ text: textOutput });
  } catch (error) {
    res.status(500).json({ text: "Erreur technique." });
  }
}
