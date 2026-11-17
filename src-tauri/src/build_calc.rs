use hsplanner_build::{BuildSnapshot, codec, gear};
use hsplanner_engine::calc::{data, planner::combined_dps, types::ItemBase};
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
    pub slots: Vec<SlotReport>,
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
}

pub fn report(link: &str, swaps_per_slot: usize) -> Result<BuildReport, String> {
    let (snapshot, _) = codec::decode(link.trim())?;
    let dps = combined_dps(&snapshot.planner_input());
    if !(dps > 0.0) {
        return Err("This build does no damage yet. Pick a main skill for it in HSPlanner.".into());
    }
    Ok(BuildReport {
        class: snapshot.class_id.as_deref().and_then(data::get_class).map(|class| class.name.clone()),
        level: snapshot.level,
        skill: snapshot.active_skill_ids.first().and_then(|id| data::skill_name_by_id(id)).map(str::to_owned),
        dps,
        slots: SLOTS.iter().map(|slot| slot_report(&snapshot, slot, dps, swaps_per_slot)).collect(),
    })
}

/// Every unique the character can wear in the slot is equipped fresh, at the
/// rolls HSPlanner gives a new copy, and measured with the same calculation
/// that produced the build's own figure. HSPlanner lets any level equip
/// anything, so the level requirement is checked here. Only swaps that raise
/// the figure are kept.
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
    let mut swaps: Vec<Swap> = candidates
        .par_iter()
        .filter_map(|base| {
            let mut trial = snapshot.clone();
            gear::commit(&mut trial, slot, Some(gear::make_item(&base.id).ok()?), false, false).ok()?;
            let dps = combined_dps(&trial.planner_input());
            (dps > base_dps).then(|| Swap {
                name: base.name.clone(),
                rarity: base.rarity.clone(),
                grade: base.grade.clone(),
                requires_level: base.requires_level,
                dps,
                gain: dps / base_dps - 1.0,
            })
        })
        .collect();
    swaps.sort_by(|a, b| b.dps.total_cmp(&a.dps));
    swaps.truncate(keep);
    SlotReport {
        slot: slot.to_owned(),
        worn: worn.and_then(|item| data::get_item(&item.base_id)).map(|base| base.name.clone()),
        swaps,
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
    fn a_link_that_is_not_a_build_says_so() {
        assert!(report("https://example.com/not-a-build", 3).is_err());
    }
}
