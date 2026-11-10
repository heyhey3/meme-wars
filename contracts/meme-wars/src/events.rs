use crate::{Contract, LogEntry, MAX_LOG_ENTRIES};
use near_sdk::json_types::U128;
use near_sdk::serde_json::{json, Map, Value};
use near_sdk::{env, AccountId};

pub const EVENT_STANDARD: &str = "meme-wars";
pub const EVENT_VERSION: &str = "1.0.0";

impl Contract {
    /// Emits a NEP-297 style `EVENT_JSON:` log and appends a bounded entry to
    /// the on-chain log ring buffer read by `get_log`.
    pub(crate) fn emit_event(
        &mut self,
        day: u64,
        event: &str,
        account: Option<AccountId>,
        faction: Option<u8>,
        amount: Option<u128>,
        mut fields: Map<String, Value>,
    ) {
        fields.insert("day".to_string(), json!(day));
        if let Some(account) = &account {
            fields.insert("account".to_string(), json!(account));
        }
        if let Some(faction) = faction {
            fields.insert("faction".to_string(), json!(faction));
        }
        if let Some(amount) = amount {
            fields.insert("amount".to_string(), json!(amount.to_string()));
        }

        let payload = json!({
            "standard": EVENT_STANDARD,
            "version": EVENT_VERSION,
            "event": event,
            "data": Value::Object(fields.clone()),
        });
        env::log_str(&format!("EVENT_JSON:{payload}"));

        let entry = LogEntry {
            id: self.next_log_id,
            day,
            event: event.to_string(),
            account,
            faction,
            amount: amount.map(U128),
            data: Value::Object(fields).to_string(),
        };
        self.record_log(entry);
    }

    fn record_log(&mut self, entry: LogEntry) {
        if (self.log.len() as u64) < MAX_LOG_ENTRIES {
            self.log.push(entry);
        } else {
            let idx = (self.next_log_id % MAX_LOG_ENTRIES) as u32;
            self.log.replace(idx, entry);
        }
        self.next_log_id = self.next_log_id.saturating_add(1);
    }
}

/// Convenience constructors for the small JSON maps used by events.
pub(crate) fn fields<const N: usize>(pairs: [(&str, Value); N]) -> Map<String, Value> {
    let mut map = Map::new();
    for (k, v) in pairs {
        map.insert(k.to_string(), v);
    }
    map
}
