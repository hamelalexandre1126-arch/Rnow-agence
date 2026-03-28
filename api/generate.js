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
TU DOIS IMPÉRATIVEMENT UTILISER LA RECHERCHE GOOGLE EN DIRECT pour chaque point afin de fournir des infos RÉELLES (Vols, prix, adresses).

STRUCTURE RNOW (11 POINTS CLÉS) :

1. ACCUEIL : Salue le client avec l'énergie Rnow.
2. ANALYSE EXPERTE : Paragraphe de 4 lignes analysant ses critères (Dest: ${destination}, Budget: ${budget}€, Envies: ${style}). Explique pourquoi ce combo est génial.
3. PROGRAMME RÉSUMÉ : Liste rapide Jour par Jour pour la vue d'ensemble.
4. DÉTAILS CHIRURGICAUX (PAR JOUR) : 
📍 L'ACTIVITÉ RNOW : [Nom] + [Expertise : pourquoi ce choix correspond à "${style}"].
💰 RÉSERVATION : [Prix exact trouvé en ligne] + [Lien réel du site officiel].
🏠 TON REFUGE : [Nom], [ADRESSE COMPLÈTE]. [Atout unique] + [Prix réel/nuit].
🍴 LA TABLE RNOW : [Nom], [ADRESSE COMPLÈTE]. [Plat signature] + [Budget réel].
🚕 TRANSPORT : [Trajet], [Mode précis], [Temps] et [Coût réel].
5. LOGISTIQUE : Vols A/R réels, Assurances (2 options chiffrées), Location (si besoin).
6. LE CONSEIL D'INITIÉ : Ton secret de local exclusif.

CONSIGNES : Format date Européen DD/MM/YYYY, UNE LIGNE d'espace entre chaque point, EMOJIS variés sans répétition, ZERO SYMBOLE (* ou #). BUDGET TOTAL : Max ${budget}€.
    `;
  } else {
    promptFinal = `Utilise la RECHERCHE GOOGLE pour modifier cet itinéraire Rnow : "${ancienItineraire}" selon le feedback : "${feedback}". Réécris l'INTÉGRALITÉ avec la même structure et les 11 points.`;
  }

  try {
    // --- DÉTECTION AUTO DU MODÈLE (RETOUR À LA MÉTHODE STABLE) ---
    const listResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const listData = await listResponse.json();
    let model = listData.models?.find(m => m.name.includes("flash")) || listData.models?.find(m => m.name.includes("pro")) || listData.models?.[0];

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${model.name}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        contents: [{ parts: [{ text: promptFinal }] }],
        tools: [{ google_search_retrieval: {} }],
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
        ]
      })
    });

    const data = await response.json();
    
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
       // On renvoie un message d'attente pro si l'API est encore en train de chercher
       return res.status(200).json({ text: "L'expert Rnow scanne actuellement le web pour vous dénicher les meilleurs prix réels... La recherche prend environ 30 secondes. Cliquez à nouveau sur 'Générer' dans un instant pour afficher le résultat !" });
    }

    let textOutput = data.candidates[0].content.parts[0].text;
    textOutput = textOutput.replace(/\*\*/g, '').replace(/\*/g, '').replace(/#/g, '');

    res.status(200).json({ text: textOutput });
  } catch (error) {
    res.status(500).json({ text: "Connexion au web en cours... Réessayez dans quelques secondes." });
  }
}
