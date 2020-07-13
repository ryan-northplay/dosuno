import CardService from "@unapy/Services/Card"
import SocketService from "@unapy/Services/Socket"

import { Game, GameEvents } from "@unapy/Protocols/Game"
import { PlayerData, CurrentPlayerInfo, CurrentPlayerStatus } from "@unapy/Protocols/Player"
import { CardData } from "@unapy/Protocols/Card"

class GameService {
	static games: Map<string, Game> = new Map()

	static setupGame (playerId: string, gameId: string) {
		const cards = CardService.setupInitialCards()

		const initialPlayer: PlayerData = {
			id: playerId,
			name: playerId,
			handCards: [],
			usedCards: [],
			status: "online"
		}

		const game: Game = {
			maxPlayers: 4,
			type: "public",
			status: "waiting",
			round: 0,
			id: gameId,
			currentPlayerIndex: 0,
			currentGameColor: null,
			title: gameId,
			availableCards: [],
			usedCards: [],
			players: [initialPlayer],
			cards
		}

		GameService.setGameData(gameId, game)

		GameService.emitGameEvent(gameId, "GameCreated", game)
	}

	static startGame (gameId: string) {
		const game = GameService.getGame(gameId)

		const allCards = [...game?.cards]

		const currentPlayer = game?.players?.[0]

		const updatedGame: Game = {
			...game,
			status: "playing",
			players: game?.players.map(player => {
				const handCards: CardData[] = []

				for (let i = 0; i < 7; i++) {
					const selectedCard = allCards.shift()
					handCards.push(selectedCard)
				}

				return {
					...player,
					handCards: handCards.map(handCard => ({
						...handCard,
						canBeUsed: player.id === currentPlayer.id
					}))
				}
			}),
			availableCards: allCards
		}

		GameService.setGameData(gameId, updatedGame)

		GameService.emitGameEvent(gameId, "GameStarted", updatedGame)
	}

	static addPlayer (gameId: string, playerId: string) {
		const game = GameService.getGame(gameId)

		game.players = [
			...game?.players,
			{
				id: playerId,
				name: playerId,
				handCards: [],
				usedCards: [],
				status: "online"
			}
		]

		if (game.players.length < game.maxPlayers) {
			GameService.setGameData(gameId, game)

			GameService.emitGameEvent(gameId, "PlayerJoined", game)
		} else {
			GameService.emitGameEvent(gameId, "PlayerJoinFailed")
		}
	}

	static startObservingGame (gameId: string) {
		const game = GameService.getGame(gameId)

		GameService.emitGameEvent(gameId, "StartedObservingGame", game)
	}

	static purgePlayer (playerId: string) {
		for (const game of GameService.games.values()) {
			const isPlayerInGame = game?.players?.find(player => player?.id === playerId)

			if (isPlayerInGame) {
				GameService.disconnectPlayer(game?.id, playerId)
			}
		}
	}

	private static disconnectPlayer (gameId: string, playerId: string) {
		const game = GameService.getGame(gameId)

		if (game.status === "waiting") {
			game.players = game?.players?.filter(player => player.id !== playerId)
		}

		if (game.status === "playing") {
			game.players = game?.players?.map(player => {
				if (player.id === playerId) {
					return {
						...player,
						status: "offline"
					}
				} else {
					return player
				}
			})
		}

		GameService.setGameData(gameId, game)
	}

	static getGameList () {
		const games: Game[] = []

		for (const game of GameService.games.values()) {
			games.push(game)
		}

		return games
	}

	static getGame (gameId: string) {
		const game = GameService.games.get(gameId)

		return game
	}

	static nextTurn (gameId: string) {
		const currentPlayerInfo = this.getCurrentPlayerInfo(gameId)

		if (currentPlayerInfo.status === "winner") {
			GameService.emitGameEvent(gameId, "PlayerWon", currentPlayerInfo.id)
			return GameService.endGame(gameId)
		}

		if (currentPlayerInfo.status === "uno") {
			GameService.emitGameEvent(gameId, "PlayerUno", currentPlayerInfo.id)
		}

		const game = GameService.getGame(gameId)

		const totalPlayers = game?.players?.length
		const currentPlayerIndex = game?.currentPlayerIndex
		const expectedNextPlayerIndex = currentPlayerIndex + 1

		const nextPlayerIndex = (expectedNextPlayerIndex >= totalPlayers) ? 0 : expectedNextPlayerIndex
		const nextPlayer = game?.players?.[nextPlayerIndex]

		const playersWithCardUsability = GameService.buildPlayersWithCardUsability(nextPlayer.id, gameId)

		game.round++

		GameService.setGameData(gameId, {
			...game,
			currentPlayerIndex: nextPlayerIndex,
			players: playersWithCardUsability
		})
	}

	static buyCard (playerId: string, gameId: string) {
		const game = GameService.getGame(gameId)

		if (game?.availableCards?.length === 0) {
			return
		}

		const available = [...game?.availableCards]

		const card = available.shift()

		GameService.setGameData(gameId, {
			...game,
			players: game?.players?.map(player => {
				if (player.id === playerId) {
					return {
						...player,
						handCards: [card, ...player?.handCards]
					}
				} else {
					return player
				}
			}),
			availableCards: available
		})
	}

	static putCard (playerId: string, cardId: string, gameId: string) {
		const game = GameService.getGame(gameId)

		const player = game?.players?.find(player => player.id === playerId)

		const card = player?.handCards?.find(card => card.id === cardId)

		GameService.setGameData(gameId, {
			...game,
			players: game?.players?.map(player => {
				if (player.id === playerId) {
					return {
						...player,
						handCards: player?.handCards?.filter(card => card.id !== cardId),
						usedCards: [card, ...player?.usedCards]
					}
				} else {
					return player
				}
			}),
			usedCards: [card, ...game?.usedCards],
			currentGameColor: card?.color
		})
	}

	private static emitGameEvent (gameId: string, event: GameEvents, data?: Game | any) {
		SocketService.emitRoomEvent(gameId, event, data)
	}

	private static setGameData (gameId: string, game: Game) {
		GameService.games.set(gameId, game)

		GameService.emitGameEvent(gameId, "GameStateChanged", game)
	}

	private static getTopStackCard (gameId: string) {
		const game = GameService.getGame(gameId)

		return game?.usedCards?.[0]
	}

	private static buildPlayersWithCardUsability (currentPlayerId: string, gameId: string): PlayerData[] {
		const game = GameService.getGame(gameId)
		const topStackCard = GameService.getTopStackCard(gameId)

		const playersWithCardUsability = game?.players?.map(player => {
			if (currentPlayerId === player.id) {
				return {
					...player,
					handCards: player?.handCards?.map(handCard => ({
						...handCard,
						canBeUsed: topStackCard.color === handCard.color
					}))
				}
			} else {
				return {
					...player,
					handCards: player?.handCards?.map(handCard => ({
						...handCard,
						canBeUsed: false
					}))
				}
			}
		})

		return playersWithCardUsability
	}

	private static getCurrentPlayerInfo (gameId: string): CurrentPlayerInfo {
		const game = GameService.getGame(gameId)

		const { players } = game

		const currentPlayer = players[game?.currentPlayerIndex]

		const currentPlayerId = currentPlayer?.id
		let status: CurrentPlayerStatus

		/**
		 * In case the current player has no card on hand, he's the winner
		 */
		if (currentPlayer?.handCards.length === 0) {
			status = "winner"
		/**
		 * In case the player has only one card, he's made uno
		 */
		} else if (currentPlayer?.handCards.length === 1) {
			status = "uno"
		}

		return {
			id: currentPlayerId,
			status
		}
	}

	private static endGame (gameId: string) {
		const game = GameService.getGame(gameId)

		game.status = "ended"

		GameService.setGameData(gameId, game)

		GameService.emitGameEvent(gameId, "GameEnded")
	}
}

export default GameService
