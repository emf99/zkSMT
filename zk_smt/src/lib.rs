// === 1. zk_smt Crate (lib.rs) ===

use ark_bls12_381::Fr;
use ark_ff::{PrimeField, BigInteger};
use ark_std::vec::Vec;
use std::collections::BTreeMap;
use sha2::{Sha256, Digest};

const TREE_DEPTH: usize = 256;

#[derive(Clone)]
pub struct SparseMerkleTree {
    pub data: BTreeMap<String, String>,
    pub root: Fr,
    pub default_hashes: Vec<Fr>,
}

impl SparseMerkleTree {
    pub fn new() -> Self {
        let mut default_hashes = vec![Fr::from(0u64); TREE_DEPTH + 1];
        
        // Pre-compute default hashes for empty subtrees
        for i in 0..TREE_DEPTH {
            let left = default_hashes[i];
            let right = default_hashes[i];
            default_hashes[i + 1] = hash_two_to_one(left, right);
        }
        
        Self {
            data: BTreeMap::new(),
            root: default_hashes[TREE_DEPTH],
            default_hashes,
        }
    }

    pub fn root(&self) -> Fr {
        self.root
    }

    fn compute_root(&mut self) {
        if self.data.is_empty() {
            self.root = Fr::from(0u64);
            return;
        }

        // Simple but correct implementation:
        // Hash all key-value pairs and combine them
        let mut combined_hash = Fr::from(0u64);
        
        for (key, value) in &self.data {
            let key_hash = hash_string(key);
            let value_hash = hash_string(value);
            let pair_hash = hash_two_to_one(key_hash, value_hash);
            combined_hash = hash_two_to_one(combined_hash, pair_hash);
        }
        
        self.root = combined_hash;
    }
}

fn hash_string(s: &str) -> Fr {
    let mut hasher = Sha256::new();
    hasher.update(s.as_bytes());
    let result = hasher.finalize();
    Fr::from_le_bytes_mod_order(&result[..])
}

fn hash_two_to_one(left: Fr, right: Fr) -> Fr {
    let mut hasher = Sha256::new();
    hasher.update(left.into_bigint().to_bytes_le());
    hasher.update(right.into_bigint().to_bytes_le());
    let result = hasher.finalize();
    Fr::from_le_bytes_mod_order(&result[..])
}

pub fn insert_to_tree(tree: &mut SparseMerkleTree, key: &str, value: &str) {
    tree.data.insert(key.to_string(), value.to_string());
    tree.compute_root();
}

pub fn delete_from_tree(tree: &mut SparseMerkleTree, key: &str) {
    tree.data.remove(key);
    tree.compute_root();
}

pub struct PathElement {
    pub value: Vec<u8>,
    pub is_left: bool,
}

pub struct MerkleTreePath {
    pub path: Vec<PathElement>,
}

pub fn get_merkle_path(tree: &SparseMerkleTree, key: &str) -> MerkleTreePath {
    let mut path = vec![];
    
    // Sprawdź czy klucz istnieje w drzewie
    if !tree.data.contains_key(key) {
        return MerkleTreePath { path };
    }
    
    // Dla uproszczenia: generuj proof jako wszystkie inne pary w drzewie
    // W prawdziwej implementacji SMT byłaby to ścieżka przez drzewo
    for (k, v) in &tree.data {
        if k != key {
            let other_key_hash = hash_string(k);
            let other_value_hash = hash_string(v);
            let combined_hash = hash_two_to_one(other_key_hash, other_value_hash);
            
            path.push(PathElement {
                value: combined_hash.into_bigint().to_bytes_le(),
                is_left: true, // W prawdziwej implementacji zależałoby od pozycji w drzewie
            });
        }
    }
    MerkleTreePath { path }
}

pub fn verify_proof(proof_bytes: Vec<u8>, inputs: (&str, u64, &[u8])) -> bool {
    let (name, id, expected_root_bytes) = inputs;
    
    // Deserializuj proof (w uproszczeniu - proof to lista hashów)
    if proof_bytes.len() % 32 != 0 {
        return false; // Nieprawidłowy format proof'a
    }
    
    // Oblicz hash pary (name, id)
    let name_hash = hash_string(name);
    let id_hash = hash_string(&id.to_string());
    let mut current_hash = hash_two_to_one(name_hash, id_hash);
    
    // Przetworz każdy element proof'a
    let num_proof_elements = proof_bytes.len() / 32;
    for i in 0..num_proof_elements {
        let start = i * 32;
        let end = start + 32;
        let proof_element = &proof_bytes[start..end];
        
        let proof_hash = Fr::from_le_bytes_mod_order(proof_element);
        current_hash = hash_two_to_one(current_hash, proof_hash);
    }
    
    // Porównaj z oczekiwanym rootem
    let expected_root = Fr::from_le_bytes_mod_order(expected_root_bytes);
    current_hash == expected_root
}