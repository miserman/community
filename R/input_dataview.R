#' Add a unified data view to a website
#'
#' Collects specified inputs to create a filtered dataset from which outputs can pull.
#'
#' @param id An ID of the data view, for association with output elements. Defaults to \code{'view'} appended
#' with a zero-index of views, based on the order in which they were specified
#' (e.g., \code{'view0'} for the first view).
#' @param y Primary variable of interest, used by default to color elements in outputs, and shown on the y-axis
#' of plots; name of a variable or ID of a variable selector.
#' @param x Secondary variable, shown by default on the x-axis of plots, and across columns in a single-variable table;
#' name of a variable or ID of a variable selector.
#' @param time Name of a variable giving names to multiple time points (such as a vector of years). Defaults to
#' the time specified in an associated metadata, or a sequence along each variable.
#' @param time_agg Specifies how multiple time points should be treated when a single value is required.
#' Default is to use the last time with data. This could point to an input which selects a time.
#' @param time_filters A list with entries specifying which years to display. Each entry should be a list
#' with entries for \code{"variable"} (which variable is being filtered, which can be \code{"index"}),
#' \code{"type"} (specifying the operator, such as \code{">"}), and \code{"value"}. The value of each entry
#' can be static (e.g., referring to a variable) or the ID of an input.
#' @param dataset Select which dataset to pull from; the name of an included dataset, or ID of a
#' selector of dataset names.
#' @param ids Select which IDs to include; a vector of IDs that appear in the specified dataset, or the ID of a
#' selector of IDs. If an IDs map is included in the site's datapackage, mapped components can be referred to here.
#' @param features Select IDs based on their features; a named list or vector, with names corresponding to
#' the names of features included in an \code{ids} field of the site's datapackage, and values corresponding to
#' a value or vector of values, or a selector of values.
#' @param variables Select IDs based on the values of their variables; a list of lists with entries for
#' \code{"variable"} (name of the variable), \code{"type"} (comparison operator), and \code{"value"} (value to
#' check against). For example, \code{list(list(variable = "a", type = ">", value = 0))}. Each entry
#' may also refer to another input.
#' @param palette The name of the color palette used in maps and plots (from
#' \href{https://colorbrewer2.org}{colorbrewer}); one of \code{"rdylbu7"} (default), \code{"orrd7"}, \code{"gnbu7"},
#' \code{"brbg7"}, \code{"puor7"}, \code{"prgn6"}, \code{"reds5"}, \code{"greens5"}, \code{"greys4"}, \code{"paired4"}.
#' @examples
#' \dontrun{
#' input_dataview()
#' }
#' @return A list of the entered options.
#' @export

input_dataview <- function(
  id = NULL,
  y = NULL,
  x = NULL,
  time = NULL,
  time_agg = "last",
  time_filters = list(),
  dataset = NULL,
  ids = NULL,
  features = NULL,
  variables = NULL,
  palette = ""
) {
  caller <- parent.frame()
  building <- !is.null(attr(caller, "name")) &&
    attr(caller, "name") == "community_site_parts"
  r <- list(palette = tolower(palette))
  if (!is.null(y)) r$y <- y
  if (!is.null(x)) r$x <- x
  if (!is.null(time)) r$time <- time
  if (!is.null(time_agg)) r$time_agg <- time_agg
  if (!length(time_filters)) r$time_filters <- time_filters
  if (!is.null(dataset)) r$dataset <- dataset
  if (!is.null(ids)) r$ids <- ids
  if (!is.null(features)) r$features <- as.list(features)
  if (!is.null(variables))
    r$variables <- if (!is.list(variables[[1]])) list(variables) else variables
  if (length(r) && building) {
    caller$dataviews[[
      if (is.null(id)) paste0("view", length(caller$dataviews)) else id
    ]] <- r
  }
  r
}
