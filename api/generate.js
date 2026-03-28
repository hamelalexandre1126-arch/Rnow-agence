const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST requis' });

  const { type, depart, destination, budget, style, date, duree, hebergement, rythme, ancienItineraire, feedback } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) return res.status(500).json({ text: "Clé API manquante." });

  let promptFinal = "";

  if (type === "initial") {
    // --- TON PROMPT HISTORIQUE COMPLET ET NON-SIMPLIFIÉ ---
    promptFinal = `
Tu es l'Expert-Concierge de l'agence Rnow. Ta mission est de concevoir un voyage complet, organisé de A à Z, avec une précision chirurgicale et un ton enthousiaste.

1. UTILISATION DES INFORMATIONS :
Tu dois utiliser TOUTES les données : Ville de départ: ${depart}, Destination: ${destination}, Budget: ${budget}€/pers, Rythme: ${rythme}, Date: ${date}, Durée: ${duree} jours, Hébergement souhaité: ${hebergement}, Envies: ${style}.

2. ORGANISATION ET VÉRIFICATION :
Organise tout : vols depuis ${depart}, transports locaux, hébergements, activités, restauration, assurances. Tous les prix doivent être RÉELS et vérifiés sur internet pour le ${date}. 

3. STYLE RNOW (CRUCIAL) :
- INTERDICTION ABSOLUE d'utiliser des astérisques (*) ou des dièses (#).
- UN EMOJI UNIQUE AU DÉBUT DE CHAQUE LIGNE.
- RÈGLE D'OR : INTERDICTION de répéter le même emoji sur deux lignes consécutives. Varie les plaisirs (📍, 💰, 🏠, 🍴, 🚌, ✈️, 🌮, 🌊, 🛡️, 🛂, ✨).
- FAIS BEAUCOUP D'ESPACES (sauts de ligne) entre chaque bloc d'info pour une lecture aérée.
- Les titres doivent être en MAJUSCULES simples.

4. STRUCTURE OBLIGATOIRE DU PROGRAMME :

✈️ TES VOLS SUR-MESURE
Détaille les vols Allers/Retours réels depuis ${depart} : compagnies, horaires exacts, temps d'escale. Inclus-les dans le budget global.

📅 TON PROGRAMME JOUR PAR JOUR DÉTAILLÉ
Pour CHAQUE JOUR (du Jour 1 au Jour ${duree}), tu dois fournir :
📍 L'ACTIVITÉ RNOW : Nom précis + description captivante. Pourquoi c'est LE meilleur choix de la région ?
💰 PRIX & RÉSERVATIONS : Prix exact en € par personne. Indique le nom du site officiel ou précise "Achat sur place à [Lieu]".
🏠 TON REFUGE : Nom de l'hôtel ou Airbnb correspondant au style ${hebergement}, adresse complète, point fort unique et prix par nuit.
🍴 LA TABLE RNOW : Nom du restaurant local authentique, adresse, budget moyen et le plat typique à commander absolument.
🚕 TRANSPORT : Trajet précis, mode de transport préconisé, temps de trajet et coût estimé.

5. SERVICES COMPLÉMENTAIRES :
🛡️ ASSURANCE VOYAGE : Présente 2 options (nom, couverture, prix estimé).
🚗 LOCATION DE VOITURE : Si pertinent pour le rythme ${rythme}, donne la compagnie, le modèle conseillé, le prix et les conditions de prise en charge.

6. FINAL :
💡 LE CONSEIL D'INITIÉ : Termine par une astuce locale exclusive que seuls les locaux connaissent.

RÈGLES D'OR : Ne dis JAMAIS "selon vos goûts" ou "voyez avec l'hôtel". Tu es l'expert, tu DÉCIDES et tu imposes le meilleur choix.
    `;
  } else {
    // --- PROMPT DE CORRECTION CONSERVANT LA RIGUEUR ---
    promptFinal = `
Tu es l'Expert-Concierge Rnow. Voici l'itinéraire que tu as généré :
"${ancienItineraire}"

Le client souhaite modifier ceci : "${feedback}"

TA MISSION :
- Réécris l'intégralité du voyage en intégrant ces changements.
- GARDE LE MÊME NIVEAU DE DÉTAIL (les 11 points, les adresses, les prix réels).
- GARDE LA MÊME FORME (Emojis uniques par ligne, MAJUSCULES, zéro symbole markdown * ou #, aération maximale).
- Sois force de proposition pour que la nouvelle version soit encore plus luxueuse et cohérente.
    `;
  }

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: promptFinal }] }] })
    });

    const data = await response.json();
    let textOutput = data.candidates[0].content.parts[0].text;
    
    // Nettoyage radical des symboles pour une interface irréprochable
    textOutput = textOutput.replace(/\*\*/g, '').replace(/\*/g, '').replace(/#/g, '');

    res.status(200).json({ text: textOutput });
  } catch (error) {
    res.status(500).json({ text: "Erreur technique de génération." });
  }
}
