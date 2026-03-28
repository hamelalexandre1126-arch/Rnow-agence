const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST requis' });

  const { type, depart, destination, budget, style, date, duree, hebergement, rythme, ancienItineraire, feedback } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) return res.status(500).json({ text: "Clé API manquante." });

  let promptFinal = "";

  if (type === "initial") {
    promptFinal = `
Tu es l'agent de voyage Rnow. Ta mission : un itinéraire d'élite, ultra-précis, sans aucun bavardage inutile.

PARAMÈTRES STRICTS : 
- Ville de départ : ${depart}
- Destination : ${destination}
- Budget total (Vols inclus) : ${budget}€/pers (ANALYSE CE BUDGET AVEC RIGUEUR)
- Style/Envies : ${style}
- Rythme : ${rythme}
- Durée : ${duree} jours dès le ${date}

CONSIGNES DE RÉDACTION (ZÉRO TOLÉRANCE) :
- SI UNE SECTION EST INUTILE (ex: pas de vols nécessaires), NE LA CITE PAS. Ne dis pas "Pas besoin de vol", ignore juste la section.
- UN EMOJI UNIQUE AU DÉBUT DE CHAQUE LIGNE.
- INTERDICTION de répéter le même emoji sur deux lignes consécutives.
- PAS d'astérisques (*), PAS de dièses (#).
- Titres en MAJUSCULES simples uniquement.

STRUCTURE OBLIGATOIRE (11 POINTS DE CONTRÔLE) :

✈️ TES VOLS SUR-MESURE (Uniquement si un trajet aérien est nécessaire)
Compagnies, horaires exacts, escales et prix réel inclus dans l'enveloppe des ${budget}€.

📅 TON PROGRAMME JOUR PAR JOUR DÉTAILLÉ
Pour CHAQUE JOUR (1 à ${duree}), fournis EXCLUSIVEMENT :
📍 L'ACTIVITÉ RNOW : Nom précis + expertise (pourquoi ce choix spécifique).
💰 PRIX & RÉSERVATIONS : Prix exact en € + lien direct site officiel ou lieu d'achat.
🏠 TON REFUGE : Nom de l'établissement, adresse complète, point fort unique et prix/nuit.
🍴 LA TABLE RNOW : Nom du resto, adresse, budget et le plat signature.
🚕 TRANSPORT : Trajet précis, mode (varie les emojis : 🏎️, 🚲, 🚤, 🚌), temps et coût.

🛡️ ASSURANCES : 2 options chiffrées.
🚗 LOCATION : Détails complets si cohérent avec le budget de ${budget}€.
💡 LE CONSEIL D'INITIÉ : Secret local exclusif.

RÈGLE D'OR : Tu es l'expert. Tu ne suggères pas, tu DÉCIDES. Chaque info doit être concrète.
    `;
  } else {
    promptFinal = `
Tu es l'agent de voyage Rnow. Modifie cet itinéraire : "${ancienItineraire}" selon ce feedback : "${feedback}".
RESTE CHIRURGICAL. Garde la précision du budget de ${budget}€ et la règle : UN EMOJI DIFFÉRENT PAR LIGNE.
    `;
  }

  try {
    const listResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const listData = await listResponse.json();
    const model = listData.models?.find(m => m.supportedGenerationMethods.includes("generateContent") && (m.name.includes("flash") || m.name.includes("pro"))) || listData.models?.[0];

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
