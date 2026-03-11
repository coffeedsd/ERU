const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;

let db;

async function connectDB() {
    if (!MONGO_URI) {
        console.error('MONGO_URI not set!');
        process.exit(1);
    }
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    db = client.db('eru_quiz');
    console.log('Connected to MongoDB Atlas');
}

app.use(cors());
app.use(express.json());

const PEOPLES = {
    russian:'Русские', ukrainian:'Украинцы', belarusian:'Белорусы',
    tatar:'Татары', bashkir:'Башкиры', chuvash:'Чуваши', yakut:'Якуты (Саха)',
    komi:'Коми', mari:'Марийцы', udmurt:'Удмурты', adygean:'Адыгейцы',
    avar:'Аварцы', chechen:'Чеченцы', circassian:'Черкесы', ingush:'Ингуши',
    kabardian:'Кабардинцы', lezgin:'Лезгины', itelmen:'Ительмены',
    koryak:'Коряки', chukchi:'Чукчи', yupik:'Эскимосы (Юпики)', aleut:'Алеуты'
};

// POST /api/quiz-result
app.post('/api/quiz-result', async (req, res) => {
    const { peopleId, score, total, questions } = req.body;
    if (!peopleId || score === undefined || !total)
        return res.status(400).json({ error: 'Missing fields' });

    const col = db.collection('quiz_stats');
    const update = {
        $inc: { totalQuizzes: 1, totalCorrect: score, totalQuestions: total },
        $set: { name: PEOPLES[peopleId] || peopleId }
    };

    if (questions && Array.isArray(questions)) {
        questions.forEach(q => {
            update.$inc[`questionStats.${q.id}.${q.correct ? 'correct' : 'wrong'}`] = 1;
            update.$set[`questionStats.${q.id}.text`] = q.text || '';
        });
    }

    await col.updateOne({ _id: peopleId }, update, { upsert: true });
    res.json({ success: true });
});

// GET /api/stats
app.get('/api/stats', async (req, res) => {
    const docs = await db.collection('quiz_stats').find({}).toArray();

    const peoples = docs.map(doc => {
        const accuracy = doc.totalQuestions > 0
            ? Math.round((doc.totalCorrect / doc.totalQuestions) * 100) : null;

        let hardestQuestion = null;
        if (doc.questionStats) {
            const hardest = Object.entries(doc.questionStats).reduce((worst, [, q]) => {
                const t = (q.correct||0) + (q.wrong||0);
                if (!t) return worst;
                const er = (q.wrong||0) / t;
                return (!worst || er > worst.er) ? { text: q.text, er } : worst;
            }, null);
            if (hardest) hardestQuestion = { text: hardest.text, errorRate: Math.round(hardest.er * 100) };
        }

        return { id: doc._id, name: doc.name, totalQuizzes: doc.totalQuizzes||0, accuracy, hardestQuestion };
    }).filter(p => p.totalQuizzes > 0).sort((a, b) => b.accuracy - a.accuracy);

    const totalQuizzes   = docs.reduce((s, d) => s + (d.totalQuizzes||0), 0);
    const totalCorrect   = docs.reduce((s, d) => s + (d.totalCorrect||0), 0);
    const totalQuestions = docs.reduce((s, d) => s + (d.totalQuestions||0), 0);
    const overallAccuracy = totalQuestions > 0 ? Math.round(totalCorrect / totalQuestions * 100) : 0;

    res.json({
        totalQuizzes, overallAccuracy,
        topBest: peoples.slice(0, 5),
        topHardest: [...peoples].sort((a, b) => a.accuracy - b.accuracy).slice(0, 5),
        allPeoples: peoples
    });
});

// GET /api/stats/:peopleId
app.get('/api/stats/:peopleId', async (req, res) => {
    const doc = await db.collection('quiz_stats').findOne({ _id: req.params.peopleId });
    if (!doc) return res.status(404).json({ error: 'Not found' });

    const accuracy = doc.totalQuestions > 0
        ? Math.round(doc.totalCorrect / doc.totalQuestions * 100) : null;

    const questions = doc.questionStats
        ? Object.entries(doc.questionStats).map(([id, q]) => {
            const t = (q.correct||0) + (q.wrong||0);
            return { id, text: q.text, correct: q.correct||0, wrong: q.wrong||0,
                errorRate: t > 0 ? Math.round((q.wrong||0) / t * 100) : 0 };
        }).sort((a, b) => b.errorRate - a.errorRate) : [];

    res.json({ id: doc._id, name: doc.name, totalQuizzes: doc.totalQuizzes, accuracy, questions });
});

app.get('/', (req, res) => res.json({ status: 'ok' }));

connectDB().then(() => app.listen(PORT, () => console.log(`Server on port ${PORT}`))).catch(err => {
    console.error(err); process.exit(1);
});
