# Technical Spec: Dynamic Function Dispatcher SDK (ResolveKit)

## 1. Concept Overview

The **ResolveKit SDK** is a runtime discovery and execution engine. It allows developers to "tag" any function with the `@ResolveKit` attribute. At runtime, the SDK "scans" the app binary, registers these functions in a central lookup table, and allows a backend command (JSON) to trigger these functions with automatic type-casting of arguments.

### Architectural Layers

1. **Metadata Layer**: Uses Swift's `Custom Reflection Metadata` (SE-0385) to preserve function pointers and signatures in the binary.
2. **Registry Layer**: A singleton `PlaybookRegistry` that maps unique string IDs to executable closures.
3. **Type Resolver**: A utility that converts JSON types (`Double`, `String`, `Bool`) into specific Swift types required by the target function.
4. **Dispatcher**: The entry point that receives backend commands and executes the matching registered function.

---

## 2. Implementation Guide

### A. The Attribute Definition

We define `@ResolveKit` using the built-in `reflectionMetadata` attribute. This forces the compiler to keep the function's metadata even in release builds.

Swift

`@reflectionMetadata
public struct ResolveKit {
    public let name: String
    
    // This initializer is called by the Swift runtime during metadata discovery
    public init<Args, Return>(attachedTo: @escaping (Args) -> Return, name: String) {
        self.name = name
        // The SDK's internal registry captures this reference automatically
        PlaybookRegistry.shared.register(name: name, function: attachedTo)
    }
}`

### B. The Registry & Type Resolver

The Registry stores "Type-Erased" wrappers. Since every function has different arguments, we wrap them in a closure that takes an `[Any]` array.

Swift

`public class PlaybookRegistry {
    public static let shared = PlaybookRegistry()
    private var functions: [String: ([Any]) -> Any?] = [:]

    // Registers a function and creates a type-safe wrapper
    func register<Args, Return>(name: String, function: @escaping (Args) -> Return) {
        functions[name] = { args in
            // Logic to deconstruct [Any] into the specific 'Args' tuple/type
            // This is where the 'Magic' happens
            return function(args as! Args) 
        }
    }

    public func execute(name: String, rawArgs: [Any]) -> Any? {
        guard let action = functions[name] else { return nil }
        return action(rawArgs)
    }
}`

### C. Backend Command Dispatcher

The SDK listens for a payload. It performs the necessary "casting" before calling the registry.

Swift

`struct PlaybookCommand: Codable {
    let action: String
    let payload: [String: Any]
}

func processBackendCommand(_ json: [String: Any]) {
    guard let action = json["action"] as? String,
          let params = json["params"] as? [Any] else { return }
    
    // Type Casting: Convert JSON types to Swift types
    // Example: Converting a 'Double' from JSON into 'Int' if required
    let resolvedParams = params.map { TypeResolver.resolve($0) }
    
    let result = PlaybookRegistry.shared.execute(name: action, rawArgs: resolvedParams)
    print("Execution Result: \(String(describing: result))")
}`

---

## 3. Developer Usage (The "App" Side)

The developer simply tags their function. No manual registration boilerplate is required.

Swift

`class GameEngine {
    @ResolveKit(name: "set_difficulty")
    func updateDifficulty(level: Int) -> Bool {
        print("Difficulty set to \(level)")
        return true
    }
}`

---

## 4. Key Considerations

Use these specific constraints:

- **Handle Variadic Arguments**: Use `Mirror` or `Metadata` scanning to determine if a function takes 1, 2, or N arguments.
- **The `@objc` Bridge**: If the app uses older Swift versions (pre-5.9), recommend using `@objc` and `NSSelectorFromString` as a fallback for discovery.
- **Thread Safety**: Ensure the `PlaybookRegistry` uses a `DispatchQueue` or `Actor` to prevent race conditions during registration.
- **Security**: Ensure the SDK validates that the "Action Name" exists in the registry to prevent arbitrary code execution from malicious payloads.