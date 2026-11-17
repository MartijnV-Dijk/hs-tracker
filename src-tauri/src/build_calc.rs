use hsplanner_build::{BuildSnapshot, codec, gear};
use hsplanner_engine::calc::{
    data,
    planner::{combined_dps, evaluate},
    skills::ELEMENTS,
    types::ItemBase,
};
use rayon::prelude::*;
use serde::Serialize;

/// The slots a farmed unique can fill. Charms, potions and relics follow rules
/// of their own (grids, stacks, one of each) and stay out of the first version.
const SLOTS: [&str; 10] =
    ["weapon", "offhand", "armor", "helmet", "gloves", "boots", "belt", "amulet", "ring_1", "ring_2"];

const UNIQUE_RARITIES: [&str; 5] = ["satanic", "satanic_set", "heroic", "angelic", "unholy"];

#[derive(Serialize)]
pub struct BuildReport {
    pub class: Option<String>,
    pub level: u32,
    pub skill: Option<String>,
    pub dps: f64,
    pub defense: Defense,
    pub slots: Vec<SlotReport>,
}

/// What keeps the character alive, as HSPlanner works it out. Effective HP is
/// life once resistances and damage reduction are counted, so it already knows
/// where a resistance stops helping. The weakest element is the one that kills.
#[derive(Debug, Serialize)]
pub struct Defense {
    pub lowest_resistance: f64,
    pub elemental_ehp: f64,
    pub physical_ehp: f64,
    pub life: f64,
}

#[derive(Serialize)]
pub struct SlotReport {
    pub slot: String,
    pub worn: Option<String>,
    pub swaps: Vec<Swap>,
}

#[derive(Serialize)]
pub struct Swap {
    pub name: String,
    pub rarity: String,
    pub grade: Option<String>,
    pub requires_level: Option<u32>,
    pub dps: f64,
    pub gain: f64,
    pub defense: Defense,
}

pub fn report(link: &str, swaps_per_slot: usize) -> Result<BuildReport, String> {
    let (snapshot, _) = codec::decode(link.trim())?;
    measure(snapshot, swaps_per_slot)
}

/// HSPlanner measures only the skills marked active, and a shared build can
/// carry none: the points are spent but nothing is ticked as being cast.
fn measure(snapshot: BuildSnapshot, swaps_per_slot: usize) -> Result<BuildReport, String> {
    if snapshot.active_skill_ids.is_empty() {
        return Err("No skill is marked active in this build, so there is no damage to measure. In HSPlanner's Skills tab, mark the skills you cast as active, then share the build again.".into());
    }
    let dps = combined_dps(&snapshot.planner_input());
    if !(dps > 0.0) {
        return Err("This build does no damage yet. Pick a main skill for it in HSPlanner.".into());
    }
    Ok(BuildReport {
        class: snapshot.class_id.as_deref().and_then(data::get_class).map(|class| class.name.clone()),
        level: snapshot.level,
        skill: snapshot.active_skill_ids.first().and_then(|id| data::skill_name_by_id(id)).map(str::to_owned),
        dps,
        defense: defense_of(&snapshot),
        slots: SLOTS.iter().map(|slot| slot_report(&snapshot, slot, dps, swaps_per_slot)).collect(),
    })
}

/// Every unique the character can wear in the slot is equipped fresh, at the
/// rolls HSPlanner gives a new copy, and measured with the same calculation
/// that produced the build's own figure. HSPlanner lets any level equip
/// anything, so the level requirement is checked here. Only swaps that raise
/// the figure are kept, and only those kept get the full stat sheet their
/// defense is read from: it costs far more than the damage figure alone.
fn slot_report(snapshot: &BuildSnapshot, slot: &str, base_dps: f64, keep: usize) -> SlotReport {
    let worn = snapshot.inventory.get(slot);
    let candidates: Vec<&ItemBase> = data::data()
        .items
        .values()
        .filter(|base| UNIQUE_RARITIES.contains(&base.rarity.as_str()))
        .filter(|base| base.requires_level.is_none_or(|needed| needed <= snapshot.level))
        .filter(|base| worn.is_none_or(|item| item.base_id != base.id))
        .filter(|base| gear::accepts(snapshot, slot, base, false))
        .collect();
    let mut measured: Vec<(&ItemBase, f64)> = candidates
        .par_iter()
        .filter_map(|base| {
            let dps = combined_dps(&wearing(snapshot, slot, base)?.planner_input());
            (dps > base_dps).then_some((*base, dps))
        })
        .collect();
    measured.sort_by(|a, b| b.1.total_cmp(&a.1));
    measured.truncate(keep);
    let swaps = measured
        .into_iter()
        .filter_map(|(base, dps)| {
            Some(Swap {
                name: base.name.clone(),
                rarity: base.rarity.clone(),
                grade: base.grade.clone(),
                requires_level: base.requires_level,
                dps,
                gain: dps / base_dps - 1.0,
                defense: defense_of(&wearing(snapshot, slot, base)?),
            })
        })
        .collect();
    SlotReport {
        slot: slot.to_owned(),
        worn: worn.and_then(|item| data::get_item(&item.base_id)).map(|base| base.name.clone()),
        swaps,
    }
}

fn wearing(snapshot: &BuildSnapshot, slot: &str, base: &ItemBase) -> Option<BuildSnapshot> {
    let mut trial = snapshot.clone();
    gear::commit(&mut trial, slot, Some(gear::make_item(&base.id).ok()?), false, false).ok()?;
    Some(trial)
}

fn defense_of(snapshot: &BuildSnapshot) -> Defense {
    let sheet = evaluate(&snapshot.planner_input()).current;
    let middle = |key: &str| sheet.stats.get(key).map_or(0.0, |(low, high)| (low + high) / 2.0);
    let ehp = |kind: &str| {
        sheet.ehp.entries.iter().find(|entry| entry.damage_type == kind).and_then(|entry| entry.ehp).unwrap_or(0.0)
    };
    Defense {
        lowest_resistance: ELEMENTS
            .iter()
            .map(|element| middle(&format!("{element}_resistance")))
            .fold(f64::INFINITY, f64::min),
        elemental_ehp: ELEMENTS.iter().map(|element| ehp(element)).fold(f64::INFINITY, f64::min),
        physical_ehp: ehp("physical"),
        life: middle("life"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// HSPlanner's own "multi-skill-s10" example, from its share code fixtures.
    const EXAMPLE: &str = "N4IghiBcpgTgtge1lADAGhAEwKYA8AXHWASwIE81McA7Ygc0sgxBJqIBsOT7aBjHFRABnArFr0CACyEA3MmG4U0AX0wAjAK4AzKMDUg+UEQWTwA7jjCziITH2FQA2gF1MWXZBA0ziu9gAHPRAAxAISRBoARigxTRwDHCNoEC1YGjZ6WNh4zG1YRAAvWmz4xJQUuD4wOigADgBWADoWPkQOLHrmlm0ScS6WzG56KQIMmizIRsGQxBJhSIHURIJnKPQAJjdWYMswUJpgsG1evBxHSCcYE5I8AElOr1FxCel-Aq40JobMcNtIKIqbZgTT0eC0VYpEiPEBEUQAfRBYIh-g4OBsHCgAGYDOowMIcA9jHiCfD4GABPDEPRxGSQZi8sheFgALKILAXVyYEjwALcPhkADyNlgpFwF1AtCkNQEWHhWDA5N4UA2qBaBgWfAA1jgCABhRCadgqzCanUEAAq5AC52c3l8DJAsDAbHUiHMIG2Zt1OEeThomi46ADXC9BDgFw2KgMWoCFyiM0xkAAbCx4Ha+NLYMz4W6OARHEMeKNxvR4cJNNnBNt4MkQxxMPAFXoDPASC3GxLW8IgpBVZhDl5-AFkvpMAFIWORMFM3Ac3mC1AoixhiXMuXK8rIA0Nb2p8IJYYs-P2gXILOq3KF-GDJCnBgsegACzbRfQAyaKD1zCyFUqIA";

    #[test]
    fn a_shared_build_reads_back_with_its_damage() {
        let report = report(EXAMPLE, 3).expect("the example decodes");
        assert!(report.class.is_some(), "the class is named");
        assert!(report.dps > 0.0);
        assert_eq!(report.slots.len(), SLOTS.len());
    }

    #[test]
    fn every_swap_raises_the_damage_and_the_best_comes_first() {
        let report = report(EXAMPLE, 3).expect("the example decodes");
        for slot in &report.slots {
            assert!(slot.swaps.len() <= 3, "{} keeps three at most", slot.slot);
            assert!(slot.swaps.iter().all(|swap| swap.dps > report.dps && swap.gain > 0.0));
            assert!(slot.swaps.windows(2).all(|pair| pair[0].dps >= pair[1].dps), "{} is ranked", slot.slot);
            assert!(slot.swaps.iter().all(|swap| slot.worn.as_ref() != Some(&swap.name)), "nothing swaps for itself");
        }
        assert!(report.slots.iter().any(|slot| !slot.swaps.is_empty()), "an example build has room to improve");
    }

    #[test]
    fn no_swap_needs_a_higher_level_than_the_character_has() {
        let report = report(EXAMPLE, 10).expect("the example decodes");
        for swap in report.slots.iter().flat_map(|slot| &slot.swaps) {
            assert!(swap.requires_level.is_none_or(|needed| needed <= report.level), "{} is out of reach", swap.name);
        }
    }

    #[test]
    fn the_build_and_every_swap_report_the_defense_they_leave() {
        let report = report(EXAMPLE, 3).expect("the example decodes");
        let sane = |defense: &Defense| {
            defense.life > 0.0
                && defense.lowest_resistance.is_finite()
                && defense.elemental_ehp > 0.0
                && defense.physical_ehp > 0.0
        };
        assert!(sane(&report.defense), "the build itself: {:?}", report.defense);
        for swap in report.slots.iter().flat_map(|slot| &slot.swaps) {
            assert!(sane(&swap.defense), "{}: {:?}", swap.name, swap.defense);
        }
    }

    #[test]
    fn a_build_with_no_active_skill_says_where_to_set_one() {
        let (mut snapshot, _) = codec::decode(EXAMPLE).expect("the example decodes");
        snapshot.active_skill_ids.clear();
        let refused = measure(snapshot, 3).err().expect("nothing to measure");
        assert!(refused.contains("Skills tab"), "{refused}");
    }

    #[test]
    fn a_link_that_is_not_a_build_says_so() {
        assert!(report("https://example.com/not-a-build", 3).is_err());
    }
}
