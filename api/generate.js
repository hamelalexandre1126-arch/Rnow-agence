const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST requis' });

  const { type, depart, destination, budget, style, date, duree, hebergement, rythme, ancienItineraire, feedback } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) return res.status(500).json({ text: "Clé API manquante." });

  let promptFinal = "";

  if (type === "initial") {
    promptFinal = `
Tu es l'Expert-Concierge Rnow. Ton ton est jeune, dynamique et ultra-professionnel.
TU DOIS UTILISER LA RECHERCHE GOOGLE EN DIRECT pour chaque point afin de fournir des infos RÉELLES.

MISSION DANS CET ORDRE PRÉCIS (LES 11 POINTS RNOW) :

1. ACCUEIL : Salue le client avec l'énergie Rnow.
2. ANALYSE EXPERTE : Paragraphe de 4 lignes analysant ses critères (Dest: ${destination}, Budget: ${budget}€, Envies: ${style}). Explique comment tu optimises son voyage.
3. PROGRAMME RÉSUMÉ : Liste rapide Jour par Jour (ex: Jour 1 : Arrivée et découverte de...) pour la vue d'ensemble.
4. DÉTAILS CHIRURGICAUX (PAR JOUR) : Utilise la recherche en ligne pour :
📍 L'ACTIVITÉ RNOW : [Nom] + [Expertise : pourquoi ce choix correspond à "${style}"].
💰 RÉSERVATION : [Prix exact trouvé en ligne] + [Lien réel du site officiel].
🏠 TON REFUGE : [Nom], [ADRESSE COMPLÈTE]. [Atout unique] + [Prix réel/nuit].
🍴 LA TABLE RNOW : [Nom], [ADRESSE COMPLÈTE]. [Plat signature] + [Budget réel].
🚕 TRANSPORT : [Trajet], [Mode précis], [Temps] et [Coût réel].
5. LOGISTIQUE GLOBALE : Inclus les Vols A/R réels, Assurances (2 options), Location (si besoin).
6. LE CONSEIL D'INITIÉ : L'astuce locale exclusive.

CONSIGNES DE FORME :
- DATE : Format Européen (ex: 28/03/2026).
- ESPACEMENT : Saute EXACTEMENT UNE LIGNE entre chaque puce (📍, 💰, etc.).
- ÉMOJIS : Un SEUL emoji au début de chaque ligne. NE JAMAIS répéter le même emoji sur deux lignes qui se suivent.
- PAS d'astérisques (*), PAS de dièses (#). Titres en MAJUSCULES simples.
- BUDGET : Tout doit être inclus dans les ${budget}€.
    `;
  } else {
    promptFinal = `Utilise la RECHERCHE GOOGLE pour modifier cet itinéraire Rnow : "${ancienItineraire}" selon le feedback : "${feedback}". Réécris l'INTÉGRALITÉ avec la même structure précise (Accueil, Analyse, Résumé, Détails, Conseil).`;
  }

  try {
    // --- DÉTECTION AUTOMATIQUE DU MODÈLE (SÉCURITÉ ANTI-BUG) ---
    const listResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const listData = await listResponse.json();
    let model = listData.models?.find(m => m.name.includes("flash")) || listData.models?.find(m => m.name.includes("pro")) || listData.models?.[0];

    // --- APPEL API AVEC RECHERCHE GOOGLE ACTIVÉE ---
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${model.name}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        contents: [{ parts: [{ text: promptFinal }] }],
        tools: [{ google_search_retrieval: {} }], // ACTIVATION DU WEB
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
        ]
      })
    });

    const data = await response.json();
    
    if (!data.candidates || !data.candidates[0]) {
      throw new Error("L'IA est en train de scanner le web pour vous. Réessayez dans 10 secondes.");
    }

    let textOutput = data.candidates[0].content.parts[0].text;
    textOutput = textOutput.replace(/\*\*/g, '').replace(/\*/g, '').replace(/#/g, '');

    res.status(200).json({ text: textOutput });
  } catch (error) {
    res.status(500).json({ text: "Recherche en cours : " + error.message });
  }
}
