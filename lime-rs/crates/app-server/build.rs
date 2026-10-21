fn main() {
    println!("cargo::rerun-if-changed=build.rs");
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("macos") {
        // Native filesystem helpers re-exec inside Seatbelt, which strips DYLD_*.
        // Runtime libraries are shipped beside the App Server by the existing packager.
        println!("cargo::rustc-link-arg-bin=app-server=-Wl,-rpath,@executable_path");
    }
}
