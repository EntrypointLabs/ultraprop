pub fn placeholder() -> &'static str {
    "Phase 1.3 implements compute_fill"
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn placeholder_works() {
        assert!(placeholder().contains("Phase 1.3"));
    }
}
