import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import pgPromise from "pg-promise";
import { Level } from "../model/level.js";
import { LEVELS } from "../levels/levels.js";
import { MAPPING, WORLDS } from "./map-ids.js";
const app = express();
const port = process.env.PORT || 3000;
const pgConString = process.env.PG_CON_STRING || 'postgres://postgres:postgres@localhost:5432';
const pgp = pgPromise();
const connection = pgp(pgConString);
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.post('/api/submitSolution', (req, res) => {
    const levelDef = LEVELS[req.body.level];
    if (!req.body.player) {
        res.status(400).send('missing player information');
        return;
    }
    if (!levelDef) {
        res.status(400).send('level does not exist');
        return;
    }
    const level = new Level(levelDef);
    const solution = req.body.solution;
    if (!Array.isArray(solution)) {
        res.status(400).send('malformed solution');
        return;
    }
    for (const step of solution) {
        level.processInput(step, true);
    }
    if (!level.won) {
        res.status(400).send('invalid solution');
        return;
    }
    const insertObj = {
        level: req.body.level,
        version: levelDef.version,
        player: req.body.player,
        steps: JSON.stringify(solution),
        stepcount: solution.length,
    };
    connection.none("INSERT INTO solutions(level, version, player, steps, stepcount) VALUES (${level}, ${version}, ${player}, ${steps}, ${stepcount})", insertObj).then(() => {
        res.send('solution accepted!');
    }).catch((e) => {
        console.log('Error: ', e);
        res.status(501).send('database error');
    });
});
app.get('/api/getLevelSolutions/:levelId', (req, res) => {
    console.log(req.params);
    const levelDef = LEVELS[req.params.levelId];
    if (!levelDef) {
        res.status(404).send('level does not exist');
        return;
    }
    const selectObj = {
        level: req.params.levelId,
        version: levelDef.version,
    };
    connection.any("SELECT player, steps, stepcount FROM solutions WHERE level=${level} AND version=${version}", selectObj).then((solutions) => {
        res.json(solutions);
    }).catch((e) => {
        console.log('Error: ', e);
        res.status(501).send('database error');
    });
});
app.get('/api/solutionsBy/:playerId', (req, res) => {
    connection.any("SELECT level, steps FROM solutions WHERE player=${player} ORDER BY version ASC", { player: req.params.playerId }).then((solutions) => {
        const resObj = {};
        for (const s of solutions) {
            resObj[s.level] = s.steps;
        }
        res.json(resObj);
    }).catch((e) => {
        console.log('Error: ', e);
        res.status(501).send('database error');
    });
});
app.get('/api/completitionCounts', (req, res) => {
    connection.any("SELECT level, COUNT(*) FROM (SELECT DISTINCT level, player from solutions) group by level").then((counts) => {
        const solvers = WORLDS.map(world => {
            return world.map(lvl => ({ levelName: lvl, solvers: 0 }));
        });
        for (const c of counts) {
            const mapping = MAPPING[c.level];
            solvers[mapping.world][mapping.level].solvers = Number.parseInt(c.count);
        }
        res.json(solvers);
    }).catch((e) => {
        console.log('Error: ', e);
        res.status(501).send('database error');
    });
});
app.use(express.static('static'));
app.listen(port, () => {
    console.log('listening on port ' + port);
});
