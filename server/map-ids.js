import OVERWORLD from '../levels/overworld.json' assert { type: "json" };
const MAPPING = {};
const WORLDS = OVERWORLD.map(world => {
    return world.nodes
        .filter(n => n.type === 'level')
        .map((n, i) => `${world.name}-${i + 1}`);
});
OVERWORLD.forEach((world, wi) => {
    let li = 0;
    for (const node of world.nodes) {
        if (node.type === 'level') {
            MAPPING[node.data.id] = { world: wi, level: li };
            li++;
        }
    }
});
export { MAPPING, WORLDS };
