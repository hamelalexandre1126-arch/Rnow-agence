const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST requis' });

  const { type, depart, destination, budget, style, date, duree, isRealSearch, ancienItineraire, feedback } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) return res.status(500).json({ text: "Clé API manquante." });

  const instructionsRnow = `
Ton ton est jeune, dynamique et ultra-professionnel.
STRUCTURE STRICTE (LES 11 POINTS) :
1. ACCUEIL : Salue le client avec l'énergie Rnow.
2. ANALYSE EXPERTE : Paragraphe (4 lignes) analysant le combo Destination/Budget/Envies.
3. PROGRAMME RÉSUMÉ : Vue d'ensemble rapide jour par jour.
4. DÉTAILS CHIRURGICAUX (PAR JOUR) :
📍 L'ACTIVITÉ RNOW : [Nom] + Expertise.
💰 RÉSERVATION : [Prix] + [Lien].
🏠 TON REFUGE : [Nom], [ADRESSE COMPLÈTE]. [Atout unique] + [Prix].
🍴 LA TABLE RNOW : [Nom], [ADRESSE COMPLÈTE]. [Plat signature] + [Budget].
🚕 TRANSPORT : [Trajet], [Mode], [Temps] et [Coût].
5. LOGISTIQUE : Vols A/R, Assurances (2 options), Location.
6. LE CONSEIL D'INITIÉ : Secret de local.

CONSIGNES : Format date DD/MM/YYYY, UNE LIGNE d'espace entre chaque puce, ÉMOJIS variés sans répétition immédiate, ZERO SYMBOLE (* ou #), BUDGET : ${budget}€.
  `;

  let promptFinal = "";

  if (isRealSearch) {
    promptFinal = `Tu es l'Expert-Concierge Rnow. UTILISE LA RECHERCHE GOOGLE pour trouver les liens RÉELS et prix du jour pour cet itinéraire : "${ancienItineraire}".
    ${instructionsRnow}`;
  } else if (type === "initial") {
    promptFinal = `Tu es l'Expert-Concierge Rnow. Fais une SIMULATION rapide (sans recherche web). 
    Paramètres : ${depart} vers ${destination}, Budget: ${budget}€, Style: ${style}, Date: ${date}, ${duree} jours.
    ${instructionsRnow}`;
  } else {
    promptFinal = `Modifie cette simulation Rnow : "${ancienItineraire}" selon le feedback : "${feedback}".
    ${instructionsRnow}`;
  }

  try {
    // --- DÉTECTION AUTO DU MODÈLE ---
    const listResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const listData = await listResponse.json();
    let model = listData.models?.find(m => m.name.includes("flash")) || listData.models?.[0];

    // --- CONSTRUCTION DU PAYLOAD (AVEC ACTIVATION GOOGLE SI BESOIN) ---
    const bodyPayload = {
      contents: [{ parts: [{ text: promptFinal }] }],
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
      ]
    };

    // L'activation cruciale pour le mode "Réel"
    if (isRealSearch) {
      bodyPayload.tools = [{ google_search_retrieval: {} }];
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${model.name}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload)
    });

    const data = await response.json();
    
    if (!data.candidates || !data.candidates[0]) {
      throw new Error("L'IA est occupée à scanner le web. Réessayez dans 10 secondes.");
    }

    let textOutput = data.candidates[0].content.parts[0].text;
    
    // Nettoyage final pour garder le style Rnow pur (pas d'astérisques ou de dièses)
    textOutput = textOutput.replace(/\*\*/g, '').replace(/\*/g, '').replace(/#/g, '');

    res.status(200).json({ text: textOutput });
  } catch (error) {
    res.status(500).json({ text: "Erreur Rnow : " + error.message });
  }
}
