import { makeStyles } from "@material-ui/core"

import Device from "@/utils/device"

const useStyles = makeStyles((theme) => {
	const cardContainerSize = Device.isMobile ? 50 : 150

	return {
		cardContent: {
			position: "relative",
			height: cardContainerSize,
			pointerEvents: "none",
			transition: theme.transitions.create("all", {
				duration: theme.transitions.duration.standard
			})
		},
		cardContainer: {
			position: "relative",
			height: cardContainerSize,
			transition: theme.transitions.create("all", {
				duration: theme.transitions.duration.standard
			})
		},
		cardChip: {
			position: "absolute",
			top: "50%",
			left: 0,
			zIndex: 9999,
			color: "#000",
			fontWeight: "bolder"
		},
		card: {
			height: cardContainerSize,
			width: "auto",
			position: "absolute",
			transition: theme.transitions.create("all", {
				duration: theme.transitions.duration.standard
			}),
			pointerEvents: "none"
		}
	}
})

export default useStyles