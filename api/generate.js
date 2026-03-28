const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST requis' });

  // On récupère TOUS les critères sans exception
  const { 
    type, 
    depart, 
    destination, 
    budget, 
    confort, 
    style, 
    date, 
    duree, 
    isRealSearch, 
    ancienItineraire, 
    feedback 
  } = req.body;

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) return res.status(500).json({ text: "Clé API manquante." });

  // --- LE PROMPT RNOW PREMIUM INTÉGRAL ---
  const instructionsRnow = `
Tu es l'Expert-Concierge de Rnow. Ton ton est dynamique et moderne, mais reste strictement professionnel (pas de mots familiers, utilise un vocabulaire élégant).

IMPORTANT : 
- Ne mets JAMAIS d'astérisques (*), de dièses (#) ou de gras (**).
- N'écris JAMAIS en majuscules (sauf pour les titres de rubriques cités ci-dessous).
- Saute une ligne entre chaque puce.

STRUCTURE DE RÉPONSE :

1. ACCUEIL : Salue le client avec élégance et professionnalisme.

2. ANALYSE EXPERTE : Un paragraphe de 4-5 lignes (uniquement en minuscules) analysant la faisabilité du voyage. 
   Critères : Destination ${destination}, Budget total ${budget}€ pour ${duree} jours, Confort souhaité ${confort}. 
   Explique précisément comment tu vas optimiser le budget moyen de ${Math.round(budget/duree)}€/jour pour respecter le niveau de confort "${confort}". Si le budget est serré, justifie tes choix (ex: privilégier l'authenticité locale pour économiser).

POUR CHAQUE JOUR (JOUR 1, JOUR 2, etc.) :
------------------------------------------
TITRE : JOUR X - [Nom de l'étape]
Une courte phrase d'introduction en minuscules décrivant l'esprit de la journée.

📍 L'ACTIVITÉ RNOW : [Nom précis de l'activité]. Description détaillée de l'expérience vécue en minuscules.
💰 RÉSERVATION : S'il faut réserver, mets [Réserver l'activité](Lien). Sinon, écris "Accès libre / Pas de réservation nécessaire".

🏠 TON REFUGE : [Nom de l'hôtel/logement]. Explique pourquoi ce choix correspond au budget et au confort ${confort} (en minuscules).
💰 RÉSERVATION : [Réserver cet hôtel](Lien).

🍴 LA TABLE RNOW : [Nom du restaurant]. Conseil gastronomique adapté au budget (en minuscules).
💰 RÉSERVATION : [Réserver une table](Lien) (si applicable).

🚕 TRANSPORT : Détaille ici les trajets du jour (Mode, Temps, Coût estimé) uniquement en minuscules.

------------------------------------------

5. LOGISTIQUE GLOBALE : Vols A/R, Assurances et Location de véhicule.
6. LE CONSEIL D'INITIÉ : Un secret de local en minuscules pour rendre le voyage inoubliable.

CONSIGNES LIENS :
- Vols : [Réserver mon vol](https://www.skyscanner.fr/transport/vols/${depart}/${destination}/${date})
- Hôtels : [Réserver cet hôtel](https://www.booking.com/searchresults.html?ss=NOM_HOTEL+${destination})
- Activités : [Réserver l'activité](https://www.getyourguide.fr/s/?q=NOM_ACTIVITE)
- SI PAS DE RÉSERVATION : Ne mets pas de lien.
  `;

  let promptFinal = "";

  if (isRealSearch) {
    promptFinal = `TRANSFORMATION RÉELLE : Reprends cet itinéraire : "${ancienItineraire}".
    Propose des noms réels d'hôtels et restos adaptés au budget de ${budget}€ et au confort "${confort}".
    Tout le texte doit être écrit en minuscules.
    ${instructionsRnow}`;
  } else if (type === "initial") {
    promptFinal = `SIMULATION INITIALE : Crée le voyage de rêve pour ${destination} (${duree} jours) dès le ${date}. 
    Budget total : ${budget}€ (soit ${Math.round(budget/duree)}€/jour). Confort souhaité : ${confort}.
    Tout le texte doit être écrit en minuscules.
    ${instructionsRnow}`;
  } else {
    promptFinal = `MODIFICATION : Applique ce changement "${feedback}" à l'itinéraire suivant : "${ancienItineraire}". 
    Respecte toujours le budget de ${budget}€ et le confort ${confort}.
    Tout le texte doit être écrit en minuscules.
    ${instructionsRnow}`;
  }

  try {
    // --- 🔍 DÉTECTION DYNAMIQUE DU MODÈLE (RESTAURATION COMPLÈTE) ---
    const listResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const listData = await listResponse.json();
    
    // On sélectionne le modèle Flash ou le premier de la liste
    let selectedModel = listData.models?.find(m => m.name.includes("flash")) || listData.models?.[0];

    if (!selectedModel) throw new Error("Aucun modèle trouvé sur votre compte Google AI.");

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/${selectedModel.name}:generateContent?key=${apiKey}`;

    const bodyPayload = {
      contents: [{ parts: [{ text: promptFinal }] }],
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" }
      ],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
      }
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload)
    });

    const data = await response.json();

    if (data.error) {
        return res.status(200).json({ text: "Erreur API Google : " + data.error.message });
    }

    if (!data.candidates || data.candidates.length === 0) {
        return res.status(200).json({ text: "L'IA n'a pas pu générer de réponse. Vérifiez vos paramètres de sécurité." });
    }

    let textOutput = data.candidates[0].content.parts[0].text;
    
    // NETTOYAGE FINAL (On enlève les gras et symboles Markdown)
    textOutput = textOutput.replace(/\*\*/g, '').replace(/\*/g, '').replace(/#/g, '');

    res.status(200).json({ text: textOutput });

  } catch (error) {
    res.status(500).json({ text: "Erreur serveur : " + error.message });
  }
}
