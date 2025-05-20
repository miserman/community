#' Format a JavaScript Color Palette
#'
#' Make a specially-formatted color palette based on color codes.
#'
#' @param colors A vector of color names or HEX codes, or a matrix-like object with
#' colors in columns, and their RGB values in separate rows.
#' @param continuous Logical; if \code{TRUE}, \code{colors} are treated as points in a linear
#' gradient. One provided color will be from white to that color. Two provided colors will
#' be between those colors. Three or four provided colors will be between the first and
#' last color, with the central color (or average of the central colors) as the midpoint.
#' @param divergent Logical; if \code{TRUE}, marks continuous scales as divergent,
#' which will reverse the lower half of the scale.
#' @param polynomial Logical; if \code{TRUE}, will fit a polynomial regression model to each color
#' channel in the specified \code{colors} sequence. Used to either compress a long sequence
#' (e.g., model a fully manually specified scale), or interpolate a scale between anchors.
#' @param degrees Number of polynomial degrees, if \code{polynomial} is \code{TRUE}.
#' @param pad If \code{polynomial} is \code{TRUE}, number of repeated observations of the
#' initial and final colors in the sequence to add in order to reduce warping at the edges.
#' @param name Name of the palette.
#' @param preview Logical; if \code{TRUE}, makes a plot showing the palette colors / scale.
#' @param print Logical; if \code{FALSE}, will not print a version of the palette.
#' @examples
#' # a discrete palette
#' util_make_palette(c("red", "green", "blue"), FALSE)
#'
#' # a continuous palette
#' util_make_palette("red")
#'
#' # a divergent continuous palette
#' util_make_palette(c("red", "green"), divergent = TRUE)
#' @return An invisible list of the created palette.
#' @export

util_make_palette <- function(
  colors,
  continuous = length(colors) < 5,
  divergent = length(colors) > 2,
  polynomial = FALSE,
  degrees = 6,
  pad = 10,
  name = "custom",
  preview = TRUE,
  print = TRUE
) {
  if (missing(polynomial) && (!missing(degrees) || !missing(pad)))
    polynomial <- TRUE
  if (polynomial) {
    if (missing(divergent)) divergent <- FALSE
    if (!missing(continuous) && !continuous) {
      cli_alert_warning(
        "{.arg polynomial} if {.val TRUE}, so {.arg continuous} will also be {.val TRUE}"
      )
    }
    continuous <- TRUE
  }
  if (is.character(colors)) {
    cols <- col2rgb(colors)
  } else {
    cols <- colors
    if (is.null(dim(cols))) {
      cols <- if (is.list(cols)) {
        as.data.frame(cols)
      } else {
        matrix(cols, 3, dimnames = list(c("red", "green", "blue")))
      }
    } else if (ncol(cols) == 3 && nrow(cols) != 3) cols <- t(cols)
  }
  if (nrow(cols) != 3)
    cli_abort("{.arg colors} could not be resolved to a matrix of RGB vectors")
  palette <- if (continuous) {
    if (polynomial) {
      rownames(cols) <- c("red", "green", "blue")
      colnames(cols) <- NULL
      x <- seq.int(0, 1, length.out = ncol(cols))
      if (max(cols) <= 1) cols <- cols * 256
      ori <- list(x = x, cols = cols)
      if (is.numeric(pad) && pad > 0) {
        x <- c(numeric(pad), x, rep(1, pad))
        cols <- cbind(
          matrix(
            rep(as.numeric(cols[, 1]), pad),
            3,
            dimnames = list(rownames(cols))
          ),
          cols,
          matrix(
            rep(as.numeric(cols[, ncol(cols)]), pad),
            3,
            dimnames = list(rownames(cols))
          )
        )
      }
      coefs <- vapply(
        1:3,
        function(ch) {
          as.numeric(
            lm(
              cols[ch, ] ~ poly(x, degree = degrees, raw = TRUE, simple = TRUE)
            )$coefficients
          )
        },
        numeric(degrees + 1)
      )
      if (anyNA(coefs))
        cli_abort(
          "this combination of inputs resulted in missing coefficient estimates"
        )
      if (preview) {
        mm <- cbind(1, poly(ori$x, degrees, raw = TRUE))
        plot(
          NA,
          xlim = c(0, 1),
          ylim = c(0, 1),
          axes = FALSE,
          pch = 15,
          cex = 2,
          main = "Palette Comparison",
          ylab = "Palette",
          xlab = "Value"
        )
        mtext(paste0("Degrees: ", degrees, ", Padding: ", pad), 3)
        axis(1)
        axis(2, c(.70, .30), c("Original", "Derived"), lwd = 0)
        n <- length(ori$x)
        points(
          ori$x,
          rep(.70, n),
          pch = "|",
          cex = 7,
          col = do.call(rgb, as.data.frame(t(ori$cols) / 256))
        )
        points(
          ori$x,
          rep(.30, n),
          pch = "|",
          cex = 7,
          col = do.call(
            rgb,
            lapply(1:3, function(ch) {
              cv <- (mm %*% coefs[, ch]) / 256
              cv[cv < 0] <- 0
              cv[cv > 1] <- 1
              cv
            })
          )
        )
      }
      list(
        name = name,
        type = paste0("continuous", "-polynomial"),
        colors = coefs
      )
    } else {
      if (length(colors) < 3) {
        if (length(colors) == 1) cols <- cbind(c(0, 0, 0), cols)
        cols <- cbind(cols[, 1], rowMeans(cols), cols[, 2])
      } else {
        if (ncol(cols) != 3)
          cols <- cbind(cols[, 1], rowMeans(cols[, 2:3]), cols[, 4])
      }
      cols <- t(cols)
      list(
        name = name,
        type = paste0("continuous", if (divergent) "-divergent"),
        colors = list(
          rbind(cols[3, ], cols[2, ] - cols[3, ]),
          cols[2, ],
          rbind(cols[1, ], cols[2, ] - cols[1, ])
        )
      )
    }
  } else {
    list(
      name = name,
      type = "discrete",
      colors = unlist(
        lapply(
          as.data.frame(cols / 255),
          function(col) do.call(rgb, as.list(col))
        ),
        use.names = FALSE
      )
    )
  }
  if (print) cat(jsonlite::toJSON(palette, auto_unbox = TRUE, pretty = TRUE))
  invisible(palette)
}
