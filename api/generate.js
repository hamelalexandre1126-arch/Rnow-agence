const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST requis' });

  const { type, depart, destination, budget, style, date, duree, isRealSearch, ancienItineraire, feedback } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) return res.status(500).json({ text: "Clé API manquante." });

  // --- CONFIGURATION DES INSTRUCTIONS RNOW (LES 11 POINTS & STYLE) ---
  const instructionsRnow = `
Ton ton est jeune, dynamique et ultra-professionnel.
STRUCTURE STRICTE (LES 11 POINTS) :
1. ACCUEIL : Salue le client avec l'énergie Rnow.
2. ANALYSE EXPERTE : Paragraphe (4 lignes) analysant le combo Destination/Budget/Envies.
3. PROGRAMME RÉSUMÉ : Vue d'ensemble rapide jour par jour.
4. DÉTAILS CHIRURGICAUX (PAR JOUR) :
📍 L'ACTIVITÉ RNOW : [Nom] + Expertise (pourquoi ce choix selon les goûts du client).
💰 RÉSERVATION : [Prix] + [Lien].
🏠 TON REFUGE : [Nom], [ADRESSE COMPLÈTE]. [Atout unique] + [Prix].
🍴 LA TABLE RNOW : [Nom], [ADRESSE COMPLÈTE]. [Plat signature] + [Budget].
🚕 TRANSPORT : [Trajet], [Mode], [Temps] et [Coût].
5. LOGISTIQUE : Vols A/R, Assurances (2 options), Location.
6. LE CONSEIL D'INITIÉ : Secret de local.

CONSIGNES DE FORME :
- DATE : Format Européen (ex: 28/03/2026).
- ESPACEMENT : Saute EXACTEMENT UNE LIGNE entre chaque puce (📍, 💰, etc.).
- ÉMOJIS : Un SEUL emoji au début de chaque ligne. NE JAMAIS répéter le même emoji sur deux lignes qui se suivent.
- PAS d'astérisques (*), PAS de dièses (#). Titres en MAJUSCULES simples.
- BUDGET : Tout doit rentrer dans l'enveloppe de ${budget}€.
  `;

  let promptFinal = "";

  if (isRealSearch) {
    promptFinal = `Tu es l'Expert-Concierge Rnow. UTILISE LA RECHERCHE GOOGLE pour transformer cette simulation en carnet RÉEL avec liens officiels et prix du jour : "${ancienItineraire}".
    ${instructionsRnow}`;
  } else if (type === "initial") {
    promptFinal = `Tu es l'Expert-Concierge Rnow. Fais une SIMULATION de voyage immédiate (sans recherche web). 
    Paramètres : ${depart} vers ${destination}, Budget: ${budget}€, Style: ${style}, Date: ${date}, ${duree} jours.
    ${instructionsRnow}`;
  } else {
    promptFinal = `Modifie cette simulation Rnow : "${ancienItineraire}" selon le feedback : "${feedback}".
    ${instructionsRnow}`;
  }

  try {
    const listResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const listData = await listResponse.json();
    let model = listData.models?.find(m => m.name.includes("flash")) || listData.models?.find(m => m.name.includes("pro")) || listData.models?.[0];

    const bodyPayload = {
      contents: [{ parts: [{ text: promptFinal }] }],
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
      ]
    };

    if (isRealSearch) {
      bodyPayload.tools = [{ google_search_retrieval: {} }];
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${model.name}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload)
    });

    const data = await response.json();
    let textOutput = data.candidates[0].content.parts[0].text;
    textOutput = textOutput.replace(/\*\*/g, '').replace(/\*/g, '').replace(/#/g, '');

    res.status(200).json({ text: textOutput });
  } catch (error) {
    res.status(500).json({ text: "Erreur technique : " + error.message });
  }
}
