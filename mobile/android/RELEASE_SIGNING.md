# Android Release Signing

O app Android release usa assinatura de producao via:

- arquivo local `mobile/android/keystore.properties`
- ou variaveis de ambiente `RELEASE_STORE_FILE`, `RELEASE_STORE_PASSWORD`, `RELEASE_KEY_ALIAS`, `RELEASE_KEY_PASSWORD`

## Arquivos locais esperados

- keystore: exemplo `mobile/android/app/restaurante-admin-release.jks`
- propriedades locais: `mobile/android/keystore.properties`

## Exemplo de `keystore.properties`

Use `mobile/android/keystore.properties.example` como referencia:

```properties
RELEASE_STORE_FILE=app/restaurante-admin-release.jks
RELEASE_STORE_PASSWORD=your-store-password
RELEASE_KEY_ALIAS=restauranteadmin
RELEASE_KEY_PASSWORD=your-key-password
```

## Gerar uma keystore release

No Windows:

```powershell
& "C:\Program Files\Microsoft\jdk-17.0.18.8-hotspot\bin\keytool.exe" -genkeypair -v -storetype PKCS12 -keystore "C:\Users\israe\Desktop\RestauranteApp\RestauranteApp\mobile\android\app\restaurante-admin-release.jks" -alias restauranteadmin -keyalg RSA -keysize 2048 -validity 3650
```

## Build release

Se estiver usando `keystore.properties`:

```powershell
$env:GRADLE_USER_HOME='C:\Users\israe\Desktop\RestauranteApp\g'
cd C:\Users\israe\Desktop\RestauranteApp\RestauranteApp\mobile\android
.\gradlew.bat assembleRelease
```

## Observacoes

- nunca versione `.jks`, `.keystore` ou `keystore.properties`
- o build falha de proposito se a configuracao release nao existir
- `buildTypes.release` usa `signingConfigs.release`
