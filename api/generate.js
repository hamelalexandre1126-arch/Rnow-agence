const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST requis' });

  const { type, depart, destination, budget, style, date, duree, hebergement, rythme, ancienItineraire, feedback } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) return res.status(500).json({ text: "Clé API manquante." });

  let promptFinal = "";

  if (type === "initial") {
    // --- TES 11 POINTS ET TES CONSIGNES DE STYLE STRICTES ---
    promptFinal = `
Tu es l'Expert-Concierge de l'agence Rnow. Ta mission est de concevoir un voyage complet, organisé de A à Z, avec une précision chirurgicale.

COORDONNÉES : 
Départ: ${depart} | Destination: ${destination} | Budget: ${budget}€/pers | Style: ${style} | Rythme: ${rythme} | Date: ${date} | Durée: ${duree} jours.

CONSIGNES DE STYLE RNOW (OBLIGATOIRES) :
- Écris avec enthousiasme et élégance. 
- UN EMOJI UNIQUE AU DÉBUT DE CHAQUE LIGNE.
- **RÈGLE D'OR : INTERDICTION de répéter le même emoji sur deux lignes consécutives. Varie les plaisirs (📍, 💰, 🏠, 🍴, 🚌, ✈️, 🌮, 🌊, 🛡️, 📅, 🛂, ✨).**
- FAIS BEAUCOUP D'ESPACES (sauts de ligne) entre chaque bloc d'info.
- INTERDICTION d'utiliser des astérisques (*) ou des dièses (#).
- Les titres doivent être en MAJUSCULES simples.

STRUCTURE DES 11 POINTS :

✈️ TES VOLS SUR-MESURE
Détaille les vols réels Allers/Retours depuis ${depart} : compagnies, horaires exacts et escales. Inclus-les dans le budget.

📅 TON PROGRAMME JOUR PAR JOUR DÉTAILLÉ
Pour CHAQUE JOUR (du Jour 1 au Jour ${duree}), tu dois fournir :
📍 L'ACTIVITÉ RNOW : Nom précis + pourquoi c'est LE meilleur choix.
💰 PRIX & RÉSERVATIONS : Prix exact en € + lien du site officiel ou lieu précis.
🏠 TON REFUGE : Nom de l'hôtel/Airbnb, adresse complète et point fort unique.
🍴 LA TABLE RNOW : Nom du resto, adresse, budget et plat typique à commander.
🚕 TRANSPORT : Trajet précis, mode de transport, temps et coût estimé.

PLUS :
🛡️ ASSURANCES : Présente 2 options d'assurance adaptées.
🚗 LOCATION : Si le rythme est "${rythme}", donne les détails (Compagnie, Prix, Modèle).
💡 LE CONSEIL D'INITIÉ : Une astuce de local exclusive pour finir en beauté.

RÈGLES MÉTIER :
- Tu DÉCIDES pour le client (pas de "selon vos goûts").
- Prix RÉELS et vérifiés pour le ${date}.
    `;
  } else {
    // --- PROMPT DE CORRECTION CONSERVANT TOUTE LA RIGUEUR ---
    promptFinal = `
Tu es l'Expert-Concierge Rnow. Le client a reçu cet itinéraire :
"${ancienItineraire}"

Il souhaite les modifications suivantes : "${feedback}"

TA MISSION :
- Réécris l'intégralité du voyage en intégrant ces changements.
- GARDE LE MÊME NIVEAU DE DÉTAIL (les 11 points, les adresses, les prix réels).
- GARDE LA MÊME FORME (Emojis variés par ligne, MAJUSCULES, zéro symbole * ou #, aération maximale).
- Sois force de proposition pour que le voyage reste cohérent et luxueux.
    `;
  }

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: promptFinal }] }] })
    });

    const data = await response.json();
    
    if (data.error) {
        return res.status(500).json({ text: "Erreur technique : " + data.error.message });
    }

    let textOutput = data.candidates[0].content.parts[0].text;
    
    // Nettoyage final des symboles Markdown
    textOutput = textOutput.replace(/\*\*/g, '').replace(/\*/g, '').replace(/#/g, '');

    res.status(200).json({ text: textOutput });
  } catch (error) {
    res.status(500).json({ text: "L'IA est momentanément saturée. Réessaie dans quelques instants." });
  }
}
