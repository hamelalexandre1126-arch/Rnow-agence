const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST requis' });

  const { type, depart, destination, budget, confort, style, date, duree, isRealSearch, ancienItineraire, feedback } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) return res.status(500).json({ text: "Clé API manquante." });

  const instructionsRnow = `
Tu es l'Expert-Concierge de Rnow. Ton ton est dynamique, moderne et strictement professionnel.
Tu dois générer l'itinéraire COMPLET du jour 1 au jour ${duree}. Ne t'arrête jamais avant la fin.

RÈGLES D'ÉCRITURE :
- Utilise une PONCTUATION PARFAITE (Majuscule en début de chaque phrase).
- Ne mets JAMAIS tout un paragraphe en MAJUSCULES.
- Pas d'astérisques (*), pas de dièses (#), pas de gras (**).
- Saute une ligne entre chaque puce.

STRUCTURE DE RÉPONSE OBLIGATOIRE :

1. ACCUEIL : Salue le client avec élégance.

2. ANALYSE : Un paragraphe de 5 lignes analysant le voyage à ${destination} avec un budget de ${budget}€ (${Math.round(budget/duree)}€/jour) en mode ${confort}.

3. VOTRE ITINÉRAIRE DÉTAILLÉ :
Pour chaque jour (du JOUR 1 au JOUR ${duree}) :
TITRE : JOUR X - [NOM DE L'ÉTAPE]
Une phrase d'introduction soignée.
📍 L'ACTIVITÉ : [Nom]. Détaille l'expérience.
💰 RÉSERVATION : [Réserver l'activité](Lien) ou "Accès libre".
🏠 TON REFUGE RNOW : [Nom]. Pourquoi ce choix.
💰 RÉSERVATION : [Réserver cet hôtel](Lien).
🍴 LA TABLE RNOW : [Nom]. Conseil gastronomique.
💰 RÉSERVATION : [Réserver une table](Lien).
🚕 TRANSPORT : Détails logistiques.

4. LOGISTIQUE GLOBALE : Vols/Train, Assurances et Location.
5. LE CONSEIL D'INITIÉ : Secret de local.

CONSIGNES LIENS :
- Vols : [Réserver mon vol](https://www.skyscanner.fr/transport/vols/${depart}/${destination}/${date})
- Hôtels : [Réserver cet hôtel](https://www.booking.com/searchresults.html?ss=NOM_HOTEL+${destination})
- Activités : [Réserver l'activité](https://www.getyourguide.fr/s/?q=NOM_ACTIVITE)
  `;

  let promptFinal = "";
  if (type === "initial") {
    promptFinal = `URGENT : Génère un itinéraire complet de ${duree} jours pour ${destination}. 
    Budget: ${budget}€. Style: ${style}. Confort: ${confort}. 
    ${instructionsRnow}`;
  } else {
    promptFinal = `Modifie cet itinéraire : "${ancienItineraire}" selon le feedback : "${feedback}". 
    Respecte la structure : ${instructionsRnow}`;
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
        // --- ON DÉSACTIVE TOUS LES FILTRES QUI POURRAIENT STOPPER LA GÉNÉRATION ---
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
        ],
        generationConfig: { 
            temperature: 0.7, 
            maxOutputTokens: 2500 // Augmenté pour éviter les coupures
        }
      })
    });

    const data = await response.json();
    
    if (data.error) return res.status(200).json({ text: "Erreur API : " + data.error.message });

    let textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text || "L'IA a rencontré un problème lors de la rédaction.";
    
    // Nettoyage Markdown
    textOutput = textOutput.replace(/\*\*/g, '').replace(/\*/g, '').replace(/#/g, '');
    
    res.status(200).json({ text: textOutput });
  } catch (error) {
    res.status(500).json({ text: "Erreur serveur technique." });
  }
}
