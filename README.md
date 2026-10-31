# Grimório

App pessoal para gerenciar coleção de cartas de **Magic: The Gathering** e **Pokémon TCG**, com foco em cartas de arte inteira (borderless / Illustration Rare).

## O que tem aqui

| Pasta | O que é |
|---|---|
| `apps-script/` | Código do app principal (Google Apps Script + planilha Google): `Codigo.gs` (servidor) e `Index.html` (telas). Cópia versionada do que está no editor do Apps Script. |
| `docs/balcao/` | **Balcão ao vivo** — página independente, publicada via GitHub Pages, que abre a câmera, lê o nome da carta, abre o preço na LigaMagic/LigaPokemon e soma a compra. |

## Balcão ao vivo

Endereço: `https://spacegaijin.github.io/grimorio/balcao/`

Abra no celular, permita a câmera, encaixe o nome da carta no retângulo. Dados das cartas vêm das APIs públicas do [Scryfall](https://scryfall.com/docs/api) (Magic) e do [TCGdex](https://tcgdex.dev) (Pokémon). Preços são consultados pelo usuário na Liga e digitados.

## App principal (Apps Script)

1. Planilha Google com abas `Cartas`, `Marcacoes` e `Dex`.
2. Extensões → Apps Script → colar `Codigo.gs` e `Index.html`.
3. Rodar `importarTudo` (cartas dos sets), `importarDexParte1`/`importarDexParte2` (Pokédex 251) e `testarFotos` (autoriza o Drive).
4. Implantar como App da Web: *Executar como: Eu* · *Quem pode acessar: Qualquer pessoa*.

## Licença

MIT.
