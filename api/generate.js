const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST requis' });

  const { depart, destination, budget, style, date, duree, hebergement, rythme } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) return res.status(500).json({ text: "Clé API manquante." });

  const promptFinal = `
Tu es l'Expert-Concierge de l'agence Rnow. Ta mission est de concevoir un voyage d'exception, clé en main, avec une esthétique parfaite.

COORDONNÉES : 
Départ: ${depart} | Destination: ${destination} | Budget: ${budget}€ | Style: ${style} | Rythme: ${rythme}.

CONSIGNES DE STYLE GÉNÉRALES (À RESPECTER SUR TOUT LE TEXTE) :
- Écris avec enthousiasme et élégance. 
- Utilise UN EMOJI UNIQUE AU DÉBUT DE CHAQUE LIGNE.
- **RÈGLE D'OR : INTERDICTION ABSOLUE de répéter le même emoji sur deux lignes consécutives ou plus de 2 fois dans la même section.**
- Varie les plaisirs : si tu parles de transport, utilise 🚕, 🚌, ✈️, 🏎️, 🎫. Si tu parles de nourriture, varie entre 🍴, 🌮, 🥗, 🍷, 🥘.
- FAIS DE GRANDS ESPACES (sauts de ligne) entre chaque bloc d'info.
- INTERDICTION d'utiliser des astérisques (*) ou des dièses (#).
- Les titres doivent être en MAJUSCULES simples.

STRUCTURE SCANABLE :

✈️ TES VOLS SUR-MESURE
[Détails aérés avec emojis variés : 🛫, 🛑, 🛬, 💺...]

📅 TON PROGRAMME JOUR PAR JOUR DÉTAILLÉ
Pour CHAQUE JOUR, respecte cette diversité (exemple) :
📍 ACTIVITÉ : [Nom].
💰 COÛT : [Prix].
🏠 REFUGE : [Hôtel].
🍴 TABLE : [Resto].
🚲 MOUVEMENT : [Transport].

🚗 TA LOCATION DE VOITURE
[Applique la règle de non-répétition ici aussi : 🏎️, 🏢, 📅, 📍, 💰, 🛂...]

💡 LE CONSEIL D'INITIÉ
[Ton secret local...]

RÈGLES MÉTIER :
- Tu DÉCIDES pour le client (pas de "selon vos goûts").
- Prix RÉELS et vérifiés.
  `;

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

    // Nettoyage final des symboles Markdown
    textOutput = textOutput.replace(/\*/g, '').replace(/#/g, '');

    res.status(200).json({ text: textOutput });
  } catch (error) {
    res.status(500).json({ text: "Erreur technique : " + error.message });
  }
}
