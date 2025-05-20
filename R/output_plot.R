#' Add a plot to a webpage
#'
#' Adds a Plotly plot to a webpage, based on specified or selected variables.
#'
#' @param x The name of a variable, or ID of a variable selector to plot along the x-axis.
#' @param y The name of a variable, or ID of a variable selector to plot along the y-axis.
#' @param color The name of a variable, or ID of a variable selector to use to color lines.
#' @param color_time The ID of a selector to specify which timepoint of \code{color} to use.
#' @param dataview The ID of an \code{\link{input_dataview}} component.
#' @param id Unique ID for the plot.
#' @param click The ID of an input to set to a clicked line's ID.
#' @param subto A vector of output IDs to receive hover events from.
#' @param options A list of configuration options, with named entries for any of \code{data}, \code{layout},
#' or \code{options}, potentially extracted from a saved plotly object (see
#' \href{https://plotly.com/javascript/configuration-options}{Plotly documentation}), if \code{plotly} is \code{TRUE}.
#' @param plotly Logical; if \code{TRUE}, uses \href{https://plotly.com/javascript}{Plotly}.
#' @examples
#' # for mpg ~ wt * am in a site based on mtcars data
#' output_plot("wt", "mpg", "am")
#' @return A character vector of the content to be added.
#' @export

output_plot <- function(
  x = NULL,
  y = NULL,
  color = NULL,
  color_time = NULL,
  dataview = NULL,
  id = NULL,
  click = NULL,
  subto = NULL,
  options = list(),
  plotly = TRUE
) {
  caller <- parent.frame()
  building <- !is.null(attr(caller, "name")) &&
    attr(caller, "name") == "community_site_parts"
  if (is.null(id)) id <- paste0("plot", caller$uid)
  entries <- c("layout", "config", "data")
  if (is.character(options)) options <- jsonlite::fromJSON(options)
  if ("x" %in% names(options)) options <- options$x
  options <- options[entries[entries %in% names(options)]]
  defaults <- list(
    layout = list(
      hovermode = "closest",
      margin = list(t = 25, r = 10, b = 40, l = 60)
    ),
    config = list(
      showSendToCloud = FALSE,
      responsive = TRUE,
      showTips = FALSE,
      displaylogo = FALSE,
      modeBarButtonsToAdd = c("hoverclosest", "hovercompare")
    ),
    data = data.frame(
      hoverinfo = "text",
      mode = "lines+markers",
      type = "scatter"
    )
  )
  so <- names(options)
  for (e in names(defaults)) {
    if (!e %in% so) {
      options[[e]] <- defaults[[e]]
    } else {
      soo <- names(options[[e]])
      for (eo in names(defaults[[e]]))
        if (!eo %in% soo) options[[e]][[eo]] <- defaults[[e]][[eo]]
    }
  }
  options$subto <- if (!is.null(subto) && length(subto) == 1) list(subto) else
    subto
  type <- if (plotly) "plotly" else "echarts"
  r <- paste(
    c(
      '<div class="plotly-wrap"><div class="auto-output plotly"',
      if (!is.null(dataview)) paste0('data-view="', dataview, '"'),
      if (!is.null(click)) paste0('data-click="', click, '"'),
      if (!is.null(x)) paste0('data-x="', x, '"'),
      if (!is.null(y)) paste0('data-y="', y, '"'),
      if (!is.null(color)) paste0('data-color="', color, '"'),
      if (!is.null(color_time)) paste0('data-colorTime="', color_time, '"'),
      paste0('id="', id, '" data-autoType="', type, '"></table></div></div>')
    ),
    collapse = " "
  )
  if (building) {
    caller$dependencies$plotly <- list(
      type = "script",
      src = "https://cdn.jsdelivr.net/npm/plotly.js@3.0.1/dist/plotly.min.js",
      hash = "sha384-8cEu0XVLh4s92OG4Ua4ZS75MN//b+0KqyCrhQqaXgHMVHnKC3DNVhwUyH5spa1J2"
    )
    caller$credits$plotly <- list(
      name = "Plotly",
      url = "https://plotly.com/javascript/getting-started",
      version = "3.0.1"
    )
    if (plotly) caller$plotly[[id]] <- options else
      caller$echarts[[id]] <- options
    caller$content <- c(caller$content, r)
    caller$uid <- caller$uid + 1
  }
  r
}
