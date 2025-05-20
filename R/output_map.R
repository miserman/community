#' Add a map to a webpage
#'
#' Adds a Leaflet map to a webpage, based on specified or selected inputs.
#'
#' @param shapes A list or list of lists specifying GeoJSON files. Each list should have at least
#' a \code{url} entry (the URL of the file), and will need a \code{name} entry (associating it
#' with one of the site's datasets) if the site has multiple datasets. The file's features
#' must each have a \code{properties} field containing an ID found in the data -- by default
#' this is assumed to be called \code{"geoid"}, but this can be specified with an \code{id_property}
#' entry in the list. For example \code{shapes = list(name = "data", }\code{
#' url = "https://example.com/shapes.geojson", id_property = "id")}. A \code{time} entry can also
#' specify different maps for the same dataset, based on the selected time, along with a \code{resolution}
#' entry to specify how to match the year; either \code{"decade"} (default) or \code{"exact"}.
#' @param overlays additional layers to add to the map, based on the selected variable; a list or list of
#' lists with entries at least for \code{variable} (name of the variable associated with the layer) and
#' \code{source} (path to the layer file, or a list with entries including \code{url} and
#' \code{time}). Entries can also include a \code{filter} entry, with a list or list of lists of conditions,
#' including entries for \code{feature} (name of the feature on which to condition entity inclusion),
#' \code{operator}, and \code{value}.
#' @param color The name of a variable, or id of a variable selector, to be used to color polygons.
#' @param color_time The ID of a selector to specify which timepoint of \code{color} to use.
#' @param dataview The ID of an \code{\link{input_dataview}} component.
#' @param id Unique ID for the map.
#' @param click The ID of an input to set to a clicked polygon's ID.
#' @param subto A vector of output IDs to receive hover events from.
#' @param background_shapes The name of a dataset (shapes) to show within a selection, regardless of
#' selected dataset. Useful to show lower-level regions within higher-level regions.
#' @param options A list of configuration options, potentially extracted from a saved leaflet object (see
#' \href{https://leafletjs.com/reference-1.7.1.html#map-example}{Leaflet documentation}).
#' @param overlays_from_measures Logical; if \code{TRUE}, will look for overlay information in
#' measurement information.
#' @param tiles A list or list of lists containing provider information (see
#' \href{https://leaflet-extras.github.io/leaflet-providers/preview/}{leaflet providers}; e.g.,
#' \code{list(}\code{url = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"}, \code{options = list(maxZoom = 19))}).
#' @param attribution A list with tile attribution information to be included in a credits section. To add
#' attributions to the map, include them in \code{tile}'s \code{options} list.
#' @examples
#' output_map()
#' @return A character vector of the content to be added.
#' @export

output_map <- function(
  shapes = NULL,
  overlays = NULL,
  color = NULL,
  color_time = NULL,
  dataview = NULL,
  id = NULL,
  click = NULL,
  subto = NULL,
  background_shapes = NULL,
  options = list(),
  overlays_from_measures = TRUE,
  tiles = list(
    url = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    options = list(maxZoom = 19)
  ),
  attribution = list(
    name = "OpenStreetMap",
    url = "https://www.openstreetmap.org/copyright"
  )
) {
  caller <- parent.frame()
  building <- !is.null(attr(caller, "name")) &&
    attr(caller, "name") == "community_site_parts"
  if (is.null(id)) id <- paste0("map", caller$uid)
  if (building) {
    caller$dependencies$leaflet_style <- list(
      type = "stylesheet",
      src = "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.min.css",
      hash = "sha384-b8ANgTJvdlAnWM5YGMpKn7Kodm+1k7NYNG9zdjTCcZcKatzYHwZ0RLdWarbJJVzU"
    )
    caller$dependencies$leaflet <- list(
      type = "script",
      src = "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.min.js",
      hash = "sha384-u5N8qJeJOO2iqNjIKTdl6KeKsEikMAmCUBPc6sC6uGpgL34aPJ4VgNhuhumedpEk"
    )
    options$overlays_from_measures <- overlays_from_measures
    options$subto <- if (!is.null(subto) && length(subto) == 1) list(subto) else
      subto
    if (is.null(options[["center"]])) options$center <- c(40, -95)
    if (is.null(options[["zoom"]])) options$zoom <- 4
    if (
      !is.null(background_shapes) && is.null(options[["background_shapes"]])
    ) {
      options$background_shapes <- background_shapes
    }
    if (is.character(shapes))
      shapes <- lapply(shapes, function(s) list(url = s))
    if (is.list(shapes) && !is.list(shapes[[1]])) shapes <- list(shapes)
    snames <- names(shapes)
    for (i in seq_along(shapes)) {
      if (!is.null(snames[i])) shapes[[i]]$name <- snames[i]
      if (is.null(shapes[[i]]$id_property)) shapes[[i]]$id_property <- "geoid"
    }
    if (!is.null(overlays)) {
      if (is.character(overlays))
        overlays <- lapply(overlays, function(s) list(url = s))
      if (is.list(overlays) && !is.list(overlays[[1]]))
        overlays <- list(overlays)
      snames <- names(overlays)
      for (i in seq_along(overlays)) {
        if (!is.null(snames[i])) overlays[[i]]$name <- snames[i]
      }
    }
    caller$map[[id]] <- Filter(
      length,
      list(
        shapes = unname(shapes),
        overlays = unname(overlays),
        options = options,
        tiles = tiles
      )
    )
  }
  r <- paste(
    c(
      '<div class="auto-output leaflet"',
      if (!is.null(dataview)) paste0('data-view="', dataview, '"'),
      if (!is.null(click)) paste0('data-click="', click, '"'),
      if (!is.null(color)) paste0('data-color="', color, '"'),
      if (!is.null(color_time)) paste0('data-colorTime="', color_time, '"'),
      paste0('id="', id, '"'),
      'data-autoType="map"></div>'
    ),
    collapse = " "
  )
  if (building) {
    caller$content <- c(caller$content, r)
    caller$credits$leaflet <- list(
      name = "Leaflet",
      url = "https://leafletjs.com",
      version = "1.9.4",
      description = "A JS library for interactive maps"
    )
    if (!missing(attribution) || missing(tiles)) {
      if (!is.null(attribution$name)) {
        caller$credits[[attribution$name]] <- attribution
      } else if (!is.null(attribution[[1]]$name)) {
        for (a in attribution) caller$credits[[a$name]] <- a
      }
    }
    caller$uid <- caller$uid + 1
  }
  r
}
