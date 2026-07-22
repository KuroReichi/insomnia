import { Database } from "../../../../core/Database";
const database = new Database();
const SkillMap = new Map();
export function registerSkill(data) {
    for (let skill of data) {
        if (SkillMap.has(skill.name))
            return;
        SkillMap.set(skill.name, skill);
    }
}
export function getAllSkill() { }
export function getSkill(name) { }
export function getEvolutions(name) { }
export function CastSkill(name, player) { }
