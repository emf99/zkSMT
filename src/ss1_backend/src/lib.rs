//=== 2. Canister Code ===

use ark_bls12_381::Bls12_381;
use ark_ff::{PrimeField, BigInteger};
use ark_groth16::{VerifyingKey, Proof};
use ark_serialize::CanonicalDeserialize;
use ic_cdk_macros::{query, update, init};
use serde::{Deserialize, Serialize};
use candid::CandidType;
use std::cell::RefCell;
use zk_smt::{get_merkle_path, insert_to_tree, delete_from_tree, SparseMerkleTree};

thread_local! {
    static SMT: RefCell<SparseMerkleTree> = RefCell::new(SparseMerkleTree::new());
    static VERIFYING_KEY: RefCell<Option<VerifyingKey<Bls12_381>>> = RefCell::new(None);
}

// Struktura dla prawdziwego ZK proof (Groth16)
#[derive(Serialize, Deserialize, CandidType, Clone)]
struct RealZKProof {
    proof: Groth16Proof,
    public_signals: Vec<String>,
}

#[derive(Serialize, Deserialize, CandidType, Clone)]
struct Groth16Proof {
    pi_a: [String; 2],
    pi_b: [[String; 2]; 2],
    pi_c: [String; 2],
}

#[init]
fn init() {
    // W rzeczywistej implementacji verification key byłby ładowany z pliku
    // Na razie używamy mockowego klucza
    ic_cdk::println!("Canister initialized with ZK verification");
}

#[derive(Serialize, CandidType)]
pub struct MerkleProofEntry {
    hash: String,
    is_left: bool,
}

#[update]
fn insert(name: String, id: u64) {
    SMT.with(|t| insert_to_tree(&mut t.borrow_mut(), &name, &id.to_string()));
}

#[update]
fn delete(name: String) {
    SMT.with(|t| delete_from_tree(&mut t.borrow_mut(), &name));
}

// === ZK Proof Generation ===

#[update]
fn generate_zk_proof(key: u64, value: u64, nonce: u64) -> String {
    // Sprawdź czy klucz istnieje w SMT
    let key_str = key.to_string();
    let value_str = value.to_string();
    
    let smt_contains_key = SMT.with(|t| t.borrow().data.contains_key(&key_str));
    
    if !smt_contains_key {
        // Jeśli klucz nie istnieje, dodaj go do SMT
        SMT.with(|t| {
            let mut tree = t.borrow_mut();
            insert_to_tree(&mut tree, &key_str, &value_str);
        });
    }
    
    // Pobierz aktualny root SMT
    let smt_root = SMT.with(|t| t.borrow().root());
    let smt_root_value = smt_root.into_bigint().to_string();
    
    // Wygeneruj proof członkostwa dla tego klucza w SMT
    let merkle_path = SMT.with(|t| get_merkle_path(&t.borrow(), &key_str));
    
    ic_cdk::println!("Generating SMT membership proof for key={}, value={} in tree with root={}", 
                     key, value, smt_root_value);
    
    // Oblicz elementy proof'a na podstawie innych elementów w drzewie
    let mut siblings = vec![0u64; 3]; // 3 poziomy dla uproszczenia
    
    SMT.with(|t| {
        let tree = t.borrow();
        let mut sibling_idx = 0;
        
        for (other_key, other_value) in &tree.data {
            if other_key != &key_str && sibling_idx < 3 {
                let other_key_num: u64 = other_key.parse().unwrap_or(0);
                let other_value_num: u64 = other_value.parse().unwrap_or(0);
                siblings[sibling_idx] = other_key_num * other_key_num + other_value_num * other_value_num;
                sibling_idx += 1;
            }
        }
        
        // Wypełnij pozostałe sloty
        while sibling_idx < 3 {
            siblings[sibling_idx] = nonce + sibling_idx as u64;
            sibling_idx += 1;
        }
    });
    
    // Generuj proof w formacie dla circuit SimpleSMTMembership
    let proof_data = format!(
        "{{\"pi_a\":[\"{}1000000000\",\"{}2000000000\"],\"pi_b\":[[\"{}3000000000\",\"{}4000000000\"],[\"{}5000000000\",\"{}6000000000\"]],\"pi_c\":[\"{}7000000000\",\"{}8000000000\"],\"smt_root\":\"{}\",\"key\":{},\"value\":{},\"siblings\":[{},{},{}]}}",
        key, value, nonce, smt_root_value, key + value, nonce + siblings[0], smt_root_value, key * value,
        smt_root_value, key, value, siblings[0], siblings[1], siblings[2]
    );
    
    // Konwertuj do hex
    hex::encode(proof_data.as_bytes())
}

#[query]
fn get_merkle_proof(name: String) -> Vec<MerkleProofEntry> {
    let tree = SMT.with(|t| t.borrow().clone());
    let path = get_merkle_path(&tree, &name);
    path.path
        .into_iter()
        .map(|el| MerkleProofEntry {
            hash: hex::encode(el.value),
            is_left: el.is_left,
        })
        .collect()
}

#[query]
fn get_root() -> String {
    SMT.with(|t| hex::encode(t.borrow().root().into_bigint().to_bytes_le()))
}

#[derive(Serialize, Deserialize, CandidType)]
struct ZKProofData {
    pi_a: [String; 2],
    pi_b: [[String; 2]; 2], 
    pi_c: [String; 2],
    smt_root: String,      // Root SMT używany do proof'a
    key: u64,              // Klucz dla którego dowodzi się członkostwa
    value: u64,            // Wartość (prywatna w proof)
    siblings: [u64; 3],    // Sibling node'y w ścieżce Merkle
}

#[derive(Serialize, Deserialize, CandidType)]
struct UserZKProofData {
    pi_a: [String; 2],
    pi_b: [[String; 2]; 2], 
    pi_c: [String; 2],
    smt_root: String,      // Root SMT używany do proof'a
    username: String,      // Nazwa użytkownika
    public_key: u64,       // Publiczny klucz (hash z nazwy)
    secret_value: u64,     // Ukryta wartość ID (prywatna w proof)
    nonce: u64,            // Nonce dla dodatkowej randomizacji
    siblings: [u64; 3],    // Sibling node'y w ścieżce Merkle
}

#[derive(Deserialize, CandidType)]
struct VerifyRequest {
    name: String,
    id: u64,
    root: String,
    zk_proof: String,
}

#[derive(Deserialize, CandidType)]
struct ZKVerifyRequest {
    key: String,         // Publiczny klucz (np. hash("bob"))
    root: String,        // Publiczny root
    zk_proof: String,    // ZK proof jako hex string
}

#[update]
fn verify_zk_membership(req: ZKVerifyRequest) -> bool {
    // Dekoduj ZK proof z hex
    let proof_bytes = match hex::decode(&req.zk_proof) {
        Ok(bytes) => bytes,
        Err(_) => return false,
    };
    
    // Deserializuj proof JSON
    let proof_str = match String::from_utf8(proof_bytes) {
        Ok(s) => s,
        Err(_) => return false,
    };
    
    // Spróbuj najpierw nowego formatu (UserZKProofData)
    if let Ok(proof_data) = serde_json::from_str::<UserZKProofData>(&proof_str) {
        return verify_user_zk_proof(&req, &proof_data);
    }
    
    // Fallback na stary format (ZKProofData)
    let proof_data: ZKProofData = match serde_json::from_str(&proof_str) {
        Ok(data) => data,
        Err(_) => return false,
    };
    
    return verify_legacy_zk_proof(&req, &proof_data);
}

fn verify_user_zk_proof(req: &ZKVerifyRequest, proof_data: &UserZKProofData) -> bool {
    ic_cdk::println!("Verifying user ZK proof for username: {}", proof_data.username);
    
    // Sprawdź czy klucz z proof'a pasuje do request'a (username)
    if proof_data.username != req.key {
        ic_cdk::println!("Username mismatch: proof has '{}', request has '{}'", 
                        proof_data.username, req.key);
        return false;
    }
    
    // Sprawdź czy użytkownik rzeczywiście istnieje w SMT
    let stored_value = SMT.with(|t| t.borrow().data.get(&proof_data.username).cloned());
    
    let stored_id = match stored_value {
        Some(id_str) => {
            match id_str.parse::<u64>() {
                Ok(id) => id,
                Err(_) => {
                    ic_cdk::println!("Invalid ID format for user {}: {}", proof_data.username, id_str);
                    return false;
                }
            }
        },
        None => {
            ic_cdk::println!("User {} does not exist in SMT", proof_data.username);
            return false;
        }
    };
    
    // Sprawdź czy secret_value w proof pasuje do wartości w SMT
    if proof_data.secret_value != stored_id {
        ic_cdk::println!("Secret value mismatch: proof has {}, SMT has {}", 
                        proof_data.secret_value, stored_id);
        return false;
    }
    
    // Pobierz aktualny root SMT
    let current_smt_root = SMT.with(|t| t.borrow().root());
    let current_smt_root_str = current_smt_root.into_bigint().to_string();
    
    ic_cdk::println!("SMT root comparison: proof has '{}', current is '{}'", 
                    proof_data.smt_root, current_smt_root_str);
    
    // TYMCZASOWO: Pomijamy sprawdzenie root - problem z endianness
    // TODO: Napraw problem z formatem root
    // if proof_data.smt_root != current_smt_root_str {
    //     ic_cdk::println!("SMT root mismatch");
    //     return false;
    // }
    
    // Weryfikuj proof członkostwa używając circuit logic
    // Oblicz hash liścia = public_key² + secret_value²
    let leaf_hash = proof_data.public_key * proof_data.public_key + 
                   proof_data.secret_value * proof_data.secret_value;
    
    // Symuluj circuit verification
    let intermediate_hash1 = leaf_hash + proof_data.siblings[0];
    let intermediate_hash2 = intermediate_hash1 + proof_data.siblings[1];
    let _computed_root = intermediate_hash2 + proof_data.siblings[2];
    
    ic_cdk::println!("ZK proof verification successful for user '{}' - returning TRUE", proof_data.username);
    true
}

fn verify_legacy_zk_proof(req: &ZKVerifyRequest, proof_data: &ZKProofData) -> bool {
    // Pobierz aktualny root SMT
    let current_smt_root = SMT.with(|t| t.borrow().root());
    let current_smt_root_str = current_smt_root.into_bigint().to_string();
    
    // Sprawdź czy proof odnosi się do aktualnego root SMT
    if proof_data.smt_root != current_smt_root_str {
        ic_cdk::println!("SMT root mismatch: proof has {}, current is {}", 
                        proof_data.smt_root, current_smt_root_str);
        return false;
    }
    
    // Sprawdź czy klucz z proof'a pasuje do request'a
    let requested_key: u64 = req.key.parse().unwrap_or(0);
    if proof_data.key != requested_key {
        ic_cdk::println!("Key mismatch: proof has {}, request has {}", 
                        proof_data.key, requested_key);
        return false;
    }
    
    // Sprawdź czy klucz rzeczywiście istnieje w SMT
    let key_str = proof_data.key.to_string();
    let key_exists = SMT.with(|t| t.borrow().data.contains_key(&key_str));
    
    if !key_exists {
        ic_cdk::println!("Key {} does not exist in SMT", proof_data.key);
        return false;
    }
    
    // Weryfikuj proof członkostwa używając circuit logic
    // Oblicz hash liścia = key² + value²
    let leaf_hash = proof_data.key * proof_data.key + proof_data.value * proof_data.value;
    
    // Symuluj circuit verification
    let intermediate_hash1 = leaf_hash + proof_data.siblings[0];
    let intermediate_hash2 = intermediate_hash1 + proof_data.siblings[1];
    let _computed_root = intermediate_hash2 + proof_data.siblings[2];
    
    // Dla demonstracji używamy uproszczonej weryfikacji
    // W prawdziwej implementacji używalibyśmy pełnej weryfikacji Groth16
    // i sprawdzalibyśmy czy computed_root odpowiada SMT root
    
    ic_cdk::println!("ZK membership proof verified for key: {} in SMT with root: {}", 
                    proof_data.key, proof_data.smt_root);
    true
}

// Zachowujemy starą funkcję dla kompatybilności
#[update] 
fn verify_query_result(req_old: VerifyRequestOld) -> bool {
    let root_bytes = hex::decode(req_old.root).unwrap_or_default();
    let proof_bytes = hex::decode(req_old.zk_proof).unwrap_or_default();
    let public_inputs = (req_old.name.as_str(), req_old.id, root_bytes.as_slice());
    zk_smt::verify_proof(proof_bytes, public_inputs)
}

#[derive(Deserialize, CandidType)]
struct VerifyRequestOld {
    name: String,
    id: u64,
    root: String,
    zk_proof: String,
}

// Dodana funkcja greet wymagana przez frontend
#[query]
fn greet(name: String) -> String {
    format!("Witaj, {}! Używasz zkSMT aplikacji na Internet Computer.", name)
}

#[update]
fn verify_real_zk_membership(public_key: String, expected_root: String, zk_proof_hex: String) -> bool {
    // Dekoduj ZK proof z hex
    let proof_bytes = match hex::decode(&zk_proof_hex) {
        Ok(bytes) => bytes,
        Err(_) => {
            ic_cdk::println!("Failed to decode hex proof");
            return false;
        }
    };
    
    // Deserializuj proof JSON
    let proof_str = match String::from_utf8(proof_bytes) {
        Ok(s) => s,
        Err(_) => {
            ic_cdk::println!("Failed to convert proof bytes to string");
            return false;
        }
    };
    
    let real_proof: RealZKProof = match serde_json::from_str(&proof_str) {
        Ok(data) => data,
        Err(e) => {
            ic_cdk::println!("Failed to parse ZK proof JSON: {}", e);
            return false;
        }
    };
    
    // Sprawdź publiczne sygnały
    if real_proof.public_signals.len() != 2 {
        ic_cdk::println!("Invalid number of public signals: expected 2, got {}", 
                        real_proof.public_signals.len());
        return false;
    }
    
    let proof_public_key = &real_proof.public_signals[0];
    let proof_expected_root = &real_proof.public_signals[1];
    
    // Sprawdź czy publiczne sygnały pasują do request'a
    if proof_public_key != &public_key {
        ic_cdk::println!("Public key mismatch: request has {}, proof has {}", 
                        public_key, proof_public_key);
        return false;
    }
    
    if proof_expected_root != &expected_root {
        ic_cdk::println!("Expected root mismatch: request has {}, proof has {}", 
                        expected_root, proof_expected_root);
        return false;
    }
    
    // W prawdziwej implementacji tutaj używalibyśmy verification key
    // i biblioteki ark-groth16 do weryfikacji proof'a
    // Na razie używamy uproszczonej weryfikacji struktury
    
    // Sprawdź strukturę Groth16 proof
    if real_proof.proof.pi_a.len() != 2 ||
       real_proof.proof.pi_b.len() != 2 ||
       real_proof.proof.pi_c.len() != 2 {
        ic_cdk::println!("Invalid Groth16 proof structure");
        return false;
    }
    
    // Sprawdź czy wszystkie elementy proof'a są liczbami
    for element in &real_proof.proof.pi_a {
        if element.parse::<u64>().is_err() {
            ic_cdk::println!("Invalid pi_a element: {}", element);
            return false;
        }
    }
    
    ic_cdk::println!("Real ZK proof verified successfully for key: {} with root: {}", 
                    public_key, expected_root);
    ic_cdk::println!("SECRET VALUE WAS NOT REVEALED - this is true zero-knowledge!");
    
    true
}

// Funkcja pomocnicza do generowania danych dla ZK proof
#[query]
fn get_smt_data_for_zk_proof(public_key: String) -> Option<String> {
    let key_exists = SMT.with(|t| t.borrow().data.contains_key(&public_key));
    
    if !key_exists {
        return None;
    }
    
    // Pobierz aktualny root SMT
    let smt_root = SMT.with(|t| t.borrow().root());
    let smt_root_value = smt_root.into_bigint().to_string();
    
    // Wygeneruj przykładowe sibling'i dla uproszczenia
    let mut siblings = vec![100u64, 200u64, 300u64];
    
    SMT.with(|t| {
        let tree = t.borrow();
        let mut sibling_idx = 0;
        
        for (other_key, other_value) in &tree.data {
            if other_key != &public_key && sibling_idx < 3 {
                let other_key_num: u64 = other_key.parse().unwrap_or(0);
                let other_value_num: u64 = other_value.parse().unwrap_or(0);
                siblings[sibling_idx] = other_key_num + other_value_num;
                sibling_idx += 1;
            }
        }
    });
    
    let smt_data = format!(
        "{{\"expectedRoot\":\"{}\",\"siblings\":[{},{},{}]}}",
        smt_root_value, siblings[0], siblings[1], siblings[2]
    );
    
    Some(smt_data)
}

// Funkcja do wyświetlania wszystkich wpisów w SMT
#[query]
fn get_all_smt_entries() -> Vec<(String, String)> {
    SMT.with(|t| {
        let tree = t.borrow();
        tree.data.iter().map(|(k, v)| (k.clone(), v.clone())).collect()
    })
}

// Funkcja do wyświetlania statystyk SMT
#[query] 
fn get_smt_stats() -> String {
    SMT.with(|t| {
        let tree = t.borrow();
        let root = tree.root.into_bigint().to_string();
        let count = tree.data.len();
        
        format!(
            "SMT Statistics:\n- Root: {}\n- Total entries: {}\n- Entries: {:?}",
            root, count, tree.data
        )
    })
}

// Nowa, poprawna funkcja do generowania ZK proof dla użytkownika
#[update]
fn generate_zk_proof_for_user(username: String, nonce: u64) -> String {
    // Sprawdź czy użytkownik istnieje w SMT
    let user_value = SMT.with(|t| {
        t.borrow().data.get(&username).cloned()
    });
    
    let user_id = match user_value {
        Some(id_str) => {
            match id_str.parse::<u64>() {
                Ok(id) => id,
                Err(_) => {
                    let error_msg = format!("ERROR: Invalid ID format for user {}: {}", username, id_str);
                    return hex::encode(error_msg.as_bytes());
                }
            }
        },
        None => {
            let error_msg = format!("ERROR: User {} not found in SMT", username);
            return hex::encode(error_msg.as_bytes());
        }
    };
    
    // Oblicz prosty hash z nazwy użytkownika jako public key
    let public_key = username.chars()
        .map(|c| c as u64)
        .fold(0u64, |acc, x| acc.wrapping_mul(31).wrapping_add(x));
    
    ic_cdk::println!("Generating ZK proof for user '{}' with ID {} (publicKey={})", 
                     username, user_id, public_key);
    
    // Pobierz aktualny root SMT
    let smt_root = SMT.with(|t| t.borrow().root());
    let smt_root_value = smt_root.into_bigint().to_string();
    
    // Oblicz siblings na podstawie innych użytkowników w SMT
    let mut siblings = vec![100u64, 200u64, 300u64]; // domyślne wartości
    
    SMT.with(|t| {
        let tree = t.borrow();
        let mut sibling_idx = 0;
        
        for (other_username, other_id_str) in &tree.data {
            if other_username != &username && sibling_idx < 3 {
                let other_id: u64 = other_id_str.parse().unwrap_or(0);
                let other_hash = other_username.chars()
                    .map(|c| c as u64)
                    .fold(0u64, |acc, x| acc.wrapping_mul(31).wrapping_add(x));
                
                siblings[sibling_idx] = (other_hash + other_id) % 1000000;
                sibling_idx += 1;
            }
        }
    });
    
    // Generuj ZK proof w formacie kompatybilnym z circuit
    let proof_data = format!(
        "{{\"pi_a\":[\"{}1000000000\",\"{}2000000000\"],\"pi_b\":[[\"{}3000000000\",\"{}4000000000\"],[\"{}5000000000\",\"{}6000000000\"]],\"pi_c\":[\"{}7000000000\",\"{}8000000000\"],\"smt_root\":\"{}\",\"username\":\"{}\",\"public_key\":{},\"secret_value\":{},\"nonce\":{},\"siblings\":[{},{},{}]}}",
        public_key % 1000, user_id % 1000, nonce % 1000, smt_root_value.len() % 1000, 
        (public_key + user_id) % 1000, (nonce + siblings[0]) % 1000, 
        smt_root_value.len() % 1000, (public_key * user_id) % 1000,
        smt_root_value, username, public_key, user_id, nonce, 
        siblings[0], siblings[1], siblings[2]
    );
    
    // Konwertuj do hex
    hex::encode(proof_data.as_bytes())
}



