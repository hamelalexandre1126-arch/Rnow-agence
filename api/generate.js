const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST requis' });

  const { type, depart, destination, budget, style, date, duree, hebergement, rythme, ancienItineraire, feedback } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) return res.status(500).json({ text: "Clé API manquante dans Vercel." });

  let promptFinal = "";

  if (type === "initial") {
    promptFinal = `
Tu es l'Expert-Concierge de l'agence Rnow. Ton but : l'efficacité absolue et l'élégance visuelle.

COORDONNÉES : 
Départ: ${depart} | Destination: ${destination} | Budget: ${budget}€/pers | Style: ${style} | Rythme: ${rythme} | Date: ${date} | Durée: ${duree} jours.

CONSIGNES DE STYLE RNOW (STRICTES) :
- NE PARLE QUE DE CE QUI EST UTILE. Si le départ (${depart}) et la destination (${destination}) sont proches, SUPPRIME la section VOLS.
- UN EMOJI UNIQUE AU DÉBUT DE CHAQUE LIGNE.
- **RÈGLE D'OR : INTERDICTION de répéter le même emoji sur deux lignes consécutives.** Varie les plaisirs (📍, 💰, 🏠, 🍴, 🚌, ✈️, 🌮, 🌊, 🛡️, 📅, 🛂, ✨).
- FAIS BEAUCOUP D'ESPACES (sauts de ligne) entre chaque bloc d'info.
- INTERDICTION d'utiliser des astérisques (*) ou des dièses (#). Titres en MAJUSCULES simples.

STRUCTURE DES 11 POINTS (À ADAPTER AU CONTEXTE) :

✈️ TES VOLS SUR-MESURE (Uniquement si nécessaire)
Détaille les vols Allers/Retours réels : compagnies, horaires exacts et escales. Inclus-les dans le budget.

📅 TON PROGRAMME JOUR PAR JOUR DÉTAILLÉ
Pour CHAQUE JOUR (du Jour 1 au Jour ${duree}), tu dois fournir :
📍 L'ACTIVITÉ RNOW : Nom précis + pourquoi c'est LE meilleur choix.
💰 PRIX & RÉSERVATIONS : Prix exact en € + lien du site officiel ou lieu précis.
🏠 TON REFUGE : Nom de l'hôtel/Airbnb, adresse complète et point fort unique.
🍴 LA TABLE RNOW : Nom du resto, adresse, budget et plat typique à commander.
🚕 TRANSPORT : Trajet précis, mode de transport (varie les emojis : 🏎️, 🚌, 🚲, 🚤), temps et coût.

PLUS :
🛡️ ASSURANCES : Présente 2 options d'assurance adaptées.
🚗 LOCATION : Si pertinent, donne les détails (Compagnie, Prix, Modèle).
💡 LE CONSEIL D'INITIÉ : Une astuce de local exclusive pour finir en beauté.

RÈGLES MÉTIER :
- Tu DÉCIDES pour le client. Prix RÉELS et vérifiés.
    `;
  } else {
    promptFinal = `
Tu es l'Expert-Concierge Rnow. Voici l'itinéraire actuel : "${ancienItineraire}"
Le client demande ces modifications : "${feedback}"
MISSION : Réécris l'intégralité du voyage en intégrant les changements. Reste CONCIS. Garde le style Rnow : emojis variés, pas de symboles markdown (* ou #), titres en MAJUSCULES.
    `;
  }

  try {
    // --- ÉTAPE 1 : AUTO-DÉTECTION SÉCURISÉE DU MODÈLE ---
    const listResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const listData = await listResponse.json();
    const model = listData.models?.find(m => m.supportedGenerationMethods.includes("generateContent") && (m.name.includes("flash") || m.name.includes("pro"))) || listData.models?.[0];

    if (!model) throw new Error("Aucun modèle de génération disponible.");

    // --- ÉTAPE 2 : GÉNÉRATION DU CONTENU ---
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${model.name}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: promptFinal }] }] })
    });

    const data = await response.json();
    let textOutput = data.candidates[0].content.parts[0].text;
    
    // Nettoyage final radical des symboles Markdown
    textOutput = textOutput.replace(/\*\*/g, '').replace(/\*/g, '').replace(/#/g, '');

    res.status(200).json({ text: textOutput });
  } catch (error) {
    res.status(500).json({ text: "Erreur technique : " + error.message });
  }
}
