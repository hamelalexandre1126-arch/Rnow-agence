const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST requis' });

  const { type, depart, destination, budget, confort, style, date, duree, isRealSearch, ancienItineraire, feedback } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) return res.status(500).json({ text: "Clé API manquante." });

  // --- TON PROMPT RNOW D'ORIGINE RESTAURÉ ---
  const instructionsRnow = `
Tu es l'Expert-Concierge de Rnow. Ton ton est dynamique, moderne et strictement professionnel.
Tu dois ABSOLUMENT générer l'itinéraire COMPLET du jour 1 au jour ${duree}.

RÈGLES D'ÉCRITURE :
- Majuscule en début de chaque phrase.
- JAMAIS de texte entièrement en MAJUSCULES (sauf les titres de rubriques).
- Pas d'astérisques (*), pas de dièses (#), pas de gras (**).
- Saute une ligne entre chaque puce pour un rendu aéré.

STRUCTURE DE RÉPONSE :

1. ACCUEIL : Salue le client avec élégance.
2. ANALYSE EXPERTE : Un paragraphe de 4-5 lignes analysant la faisabilité (Destination: ${destination}, Budget: ${budget}€, Confort: ${confort}). Explique l'optimisation de ${Math.round(budget/duree)}€/jour.

POUR CHAQUE JOUR (JOUR 1, JOUR 2, etc.) :
------------------------------------------
TITRE : JOUR X - [NOM DE L'ÉTAPE]
Une phrase courte qui résume l'ambiance de la journée.

📍 L'ACTIVITÉ RNOW : [Nom précis]. Détaille ici pourquoi c'est génial et ce qu'il va vivre.
💰 RÉSERVATION : [Réserver l'activité](Lien) uniquement si nécessaire. Sinon, écris "Accès libre".

🏠 TON REFUGE RNOW : [Nom]. Explique l'atout unique du lieu.
💰 RÉSERVATION : [Réserver cet hôtel](Lien).

🍴 LA TABLE RNOW : [Nom]. Décris le plat signature et l'ambiance.
💰 RÉSERVATION : [Réserver une table](Lien) (si applicable).

🚕 TRANSPORT : Détaille ici les trajets du jour (Mode, Temps, Coût estimé).

------------------------------------------

5. LOGISTIQUE GLOBALE : Vols A/R ou Train, Assurances et Location.
6. LE CONSEIL D'INITIÉ : Un secret de local pour rendre le voyage inoubliable.

CONSIGNES LIENS :
- Vols : [Réserver mon vol](https://www.skyscanner.fr/transport/vols/${depart}/${destination}/${date})
- Hôtels : [Réserver cet hôtel](https://www.booking.com/searchresults.html?ss=NOM_HOTEL+${destination})
- Activités : [Réserver l'activité](https://www.getyourguide.fr/s/?q=NOM_ACTIVITE)
- SI PAS DE RÉSERVATION NÉCESSAIRE : Ne mets aucun lien derrière.
  `;

  let promptFinal = "";
  if (type === "initial") {
    promptFinal = `Génère un voyage complet de ${duree} jours à ${destination}. Budget: ${budget}€. Style: ${style}. ${instructionsRnow}`;
  } else {
    promptFinal = `Modifie cet itinéraire : "${ancienItineraire}" selon le feedback : "${feedback}". ${instructionsRnow}`;
  }

  try {
    // --- 🔍 DÉTECTION DYNAMIQUE DU MODÈLE ---
    const listResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const listData = await listResponse.json();
    let selectedModel = listData.models?.find(m => m.name.includes("flash")) || listData.models?.[0];

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/${selectedModel.name}:generateContent?key=${apiKey}`;

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
        generationConfig: { 
            temperature: 0.7, 
            maxOutputTokens: 3000 // Augmenté pour éviter les coupures
        }
      })
    });

    const data = await response.json();
    if (data.error) return res.status(200).json({ text: "L'IA est sollicitée. Attendez 60s. (" + data.error.message + ")" });

    let textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text || "Erreur de génération.";
    
    // Nettoyage Markdown (On enlève les gras et symboles)
    textOutput = textOutput.replace(/\*\*/g, '').replace(/\*/g, '').replace(/#/g, '');

    res.status(200).json({ text: textOutput });

  } catch (error) {
    res.status(500).json({ text: "Erreur technique." });
  }
}
