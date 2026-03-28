const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST requis' });

  const { type, depart, destination, budget, style, date, duree, hebergement, rythme, ancienItineraire, feedback } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) return res.status(500).json({ text: "Clé API manquante." });

  let promptFinal = "";

  if (type === "initial") {
    // --- TON PROMPT SIGNATURE DE 11 POINTS RESTAURÉ ET RENFORCÉ ---
    promptFinal = `
Tu es l'Expert-Concierge Rnow. Ta mission est de concevoir un voyage d'exception, clé en main, avec une précision chirurgicale.

COORDONNÉES : 
Départ: ${depart} | Destination: ${destination} | Budget total par personne: ${budget}€ | Style: ${style} | Rythme: ${rythme}.

CONSIGNES DE STYLE RNOW (À RESPECTER ABSOLUMENT) :
- Écris avec enthousiasme et élégance. 
- Utilise UN EMOJI UNIQUE AU DÉBUT DE CHAQUE LIGNE pour créer une liste visuelle scannable.
- **RÈGLE D'OR : INTERDICTION ABSOLUE de répéter le même emoji sur deux lignes consécutives ou plus de 2 fois dans la même section.** Varie les plaisirs (📍, 💰, 🏠, 🍴, 🚌, ✈️, 🌮, 🌊).
- FAIS BEAUCOUP D'ESPACES (sauts de ligne) entre chaque bloc d'info.
- INTERDICTION d'utiliser des astérisques (*) ou des dièses (#).
- Les titres doivent être en MAJUSCULES simples.

STRUCTURE OBLIGATOIRE (TES 11 POINTS) :

✈️ TES VOLS SUR-MESURE
Détaille les vols réels Allers/Retours depuis ${depart} avec compagnies, horaires exacts et escales. Inclus-les dans le budget.

📅 TON PROGRAMME JOUR PAR JOUR DÉTAILLÉ
Pour CHAQUE JOUR (du Jour 1 au Jour ${duree}), tu dois fournir :
📍 L'ACTIVITÉ RNOW : [Nom précis]. [Pourquoi c'est LE meilleur choix].
💰 PRIX & RÉSA : [Prix exact en €]. [Site officiel ou lieu précis d'achat].
🏠 TON REFUGE : [Nom de l'hôtel/Airbnb], [Adresse complète]. [Point fort unique].
🍴 LA TABLE RNOW : [Nom du resto], [Adresse]. [Le plat typique à commander].
🚕 TRANSPORT : [Trajet précis : taxi, bus, voiture]. [Coût estimé].

PLUS :
🛡️ ASSURANCES : Présente 2 options d'assurance adaptées.
🚗 LOCATION : Si le rythme est "${rythme}" ou si c'est pertinent, donne les détails exacts de location (Prix, Compagnie).
💡 LE CONSEIL D'INITIÉ : Une astuce de local exclusive pour finir en beauté.

RÈGLES D'OR :
- Pas de phrases vagues ("voyez sur place", "selon vos goûts"). Tu DÉCIDES pour le client.
- Prix RÉELS et vérifiés.
    `;
  } else {
    // PROMPT DE CORRECTION (RESTAURANT LE STYLE RNOW)
    promptFinal = `
Tu es l'Expert-Concierge Rnow. Le client a reçu cet itinéraire :
"${ancienItineraire}"

Il souhaite les modifications suivantes : "${feedback}"

TA MISSION DE HAUTE CONCIERGERIE :
- Réécris l'intégralité de l'itinéraire en intégrant TOUTES ses demandes.
- Garde EXACTEMENT la même mise en forme Premium (Emojis uniques, majuscules simple pour les titres, aération maximale).
- Conserve les éléments qu'il n'a pas demandé de changer.
- Sois force de proposition pour que le voyage reste cohérent, luxueux et détaillé selon tes 11 points.
    `;
  }

  try {
    const listResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const listData = await listResponse.json();
    const model = listData.models?.find(m => m.supportedGenerationMethods.includes("generateContent"));
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${model.name}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: promptFinal }] }] })
    });

    const data = await response.json();
    let textOutput = data.candidates[0].content.parts[0].text;
    textOutput = textOutput.replace(/\*\*/g, '').replace(/\*/g, '').replace(/#/g, '');

    res.status(200).json({ text: textOutput });
  } catch (error) {
    res.status(500).json({ text: "Erreur technique : " + error.message });
  }
}
