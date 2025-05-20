#' Makes a measurement metadata file
#'
#' Make a \code{measure_info.json} file, or add measure entries to an existing one.
#'
#' @param path Path to the \code{measure_info.json} file, existing or to be created.
#' @param ... Lists containing individual measure items. See the Measure Entries section.
#' @param info A list containing measurement information to be added.
#' @param references A list containing citation entries. See the Reference Entries section.
#' @param strict Logical; if \code{TRUE}, will only allow recognized entries and values.
#' @param include_empty Logical; if \code{FALSE}, will omit entries that have not been provided.
#' @param overwrite_entry Logical; if \code{TRUE}, will replace rather than add to an existing entry.
#' @param render Path to save a version of \code{path} to, with dynamic entries expanded. See the
#' Dynamic Entries section.
#' @param overwrite Logical; if \code{TRUE}, will overwrite rather than add to an existing \code{path}.
#' @param write Logical; if \code{FALSE}, will not write the build or rendered measure info.
#' @param verbose Logical; if \code{FALSE}, will not display status messages.
#' @param open_after Logical; if \code{FALSE}, will not open the measure file after writing/updating.
#' @section Measure Entries:
#' Measure entries are named by the full variable name with any of these entries (if \code{strict}):
#' \itemize{
#'   \item \strong{\code{measure}}: Name of the measure.
#'   \item \strong{\code{full_name}}: Full name of the measure, which is also the name of the entry.
#'   \item \strong{\code{short_name}}: Shortest possible display name.
#'   \item \strong{\code{long_name}}: Longer display name.
#'   \item \strong{\code{category}}: Arbitrary category for the measure.
#'   \item \strong{\code{short_description}}: Shortest possible description.
#'   \item \strong{\code{long_description}}: Complete description. Either description can include
#'     TeX-style equations, enclosed in escaped square brackets (e.g.,
#'     \code{"The equation \\\\[a_{i} = b^\\\\frac{c}{d}\\\\] was used."}; or \code{$...$},
#'     \code{\\\\(...\\\\)}, or \code{\\\\begin{math}...\\\\end{math}}). The final enclosing symbol must be
#'     followed by a space or the end of the string. These are pre-render to MathML with
#'     \code{\link[katex]{katex_mathml}}.
#'   \item \strong{\code{statement}}: String with dynamic references to entity features
#'     (e.g., \code{"measure value = {value}"}). References can include:
#'     \itemize{
#'       \item \code{value}: Value of a currently displaying variable at a current time.
#'       \item \code{region_name}: Alias of \code{features.name}.
#'       \item \code{features.<entry>}: An entity feature, coming from \code{entity_info.json} or GeoJSON properties.
#'         All entities have at least \code{name} and \code{id} entries (e.g., \code{"{features.id}"}).
#'       \item \code{variables.<entry>}: A variable feature such as \code{name} which is the same as
#'         \code{full_name} (e.g., \code{"{variables.name}"}).
#'       \item \code{data.<variable>}: The value of another variable at a current time (e.g., \code{"{data.variable_a}"}).
#'     }
#'   \item \strong{\code{measure_type}}: Type of the measure's value. Recognized types are displayed in a special way:
#'     \itemize{
#'       \item \code{year} or \code{integer} show as entered (usually as whole numbers). Other numeric
#'         types are rounded to show a set number of digits.
#'       \item \code{percent} shows as \code{{value}\%}.
#'       \item \code{minutes} shows as \code{{value} minutes}.
#'       \item \code{dollar} shows as \code{${value}}.
#'       \item \code{internet speed} shows as \code{{value} Mbps}.
#'     }
#'   \item \strong{\code{unit}}: Prefix or suffix associated with the measure's type, such as \code{\%} for \code{percent},
#'     or \code{Mbps} for \code{rate}.
#'   \item \strong{\code{time_resolution}}: Temporal resolution of the variable, such as \code{year} or \code{week},
#'   \item \strong{\code{sources}}: A list or list of list containing source information, including any of these entries:
#'     \itemize{
#'       \item \code{name}: Name of the source (such as an organization name).
#'       \item \code{url}: General URL of the source (such as an organization's website).
#'       \item \code{location}: More specific description of the source (such as a the name of a particular data product).
#'       \item \code{location_url}: More direct URL to the resource (such as a page listing data products).
#'       \item \code{date_accessed}: Date of retrieval (arbitrary format).
#'     }
#'   \item \strong{\code{citations}}: A vector of reference ids (the names of \code{reference} entries; e.g., \code{c("ref1", "ref3")}).
#'   \item \strong{\code{layer}}: A list specifying an \code{\link{output_map}} overlay:
#'     \itemize{
#'       \item \code{source} (required): A URL to a GeoJSON file, or a list with a \code{url} and \code{time} entry, where
#'         \code{time} conditions the display of the layer on the current selected time. Alternative to a list that specifies time,
#'         the URL can include a dynamic reference to time, if the time values correspond to a component of the URL
#'         (e.g., \code{"https://example.com/{time}/points.geojson"}).
#'       \item \code{filter}: A list or list of lists specifying how the elements of the layer should be filtered for this variable:
#'         \itemize{
#'           \item \code{feature}: Name of the layer's property to filter on.
#'           \item \code{operator}: Operator to filter by (e.g., \code{"="} or \code{"!="}).
#'           \item \code{value}: Value to filter by.
#'         }
#'     }
#'   \item \strong{\code{categories}}: A named list of categories, with any of the other measure entries, or a
#'     \code{default} entry giving a default category name. See the Dynamic Entries section.
#'   \item \strong{\code{variants}}: A named list of variants, with any of the other measure entries, or a
#'     \code{default} entry giving a default variant name. See the Dynamic Entries section.
#' }
#' @section Dynamic Entries:
#' You may have several closely related variables in a dataset, which share sections of metadata,
#' or have formulaic differences. In cases like this, the \code{categories} and/or \code{variants} entries
#' can be used along with dynamic notation to construct multiple entries from a single template.
#'
#' Though functionally the same, \code{categories} might include broken-out subsets of some total
#' (such as race groups, as categories of a total population), whereas \code{variants} may be different
#' transformations of the same variable (such as raw counts versus percentages).
#'
#' In dynamic entries, \code{{category}} or \code{{variant}} refers to entries in the \code{categories}
#' or \code{variants} lists. By default, these are replaced with the name of each entries in those lists
#' (e.g., \code{"variable_{category}"} where \code{categories = "a"} would become \code{"variable_a"}).
#' A \code{default} entry would change this behavior (e.g., with \code{categories = list(a = list(default = "b")}
#' that would become \code{"variable_b"}). Adding \code{.name} would force the original behavior (e.g.,
#' \code{"variable_{category.name}"} would be \code{"variable_a"}). A name of \code{"blank"} is treated as
#' an empty string.
#'
#' When notation appears in a measure info entry, they will first default to a matching name in the \code{categories}
#' or \code{variants} list; for example, \code{short_name} in \code{list(short_name = "variable {category}")} with
#' \code{categories = list(a = list(short_name = "(category a)"))} would become \code{"variable (category a)"}.
#' To force this behavior, the entry name can be included in the notation (e.g.,
#' \code{"{category.short_name}"} would be \code{"variable (category a)"} in any entry).
#'
#' Only string entries are processed dynamically -- any list-like entries (such as
#' \code{source}, \code{citations}, or \code{layer}) appearing in
#' \code{categories} or \code{variants} entries will fully replace the base entry.
#'
#' Dynamic entries can be kept dynamic when passed to a data site, but can be rendered for other uses,
#' where the rendered version will have each dynamic entry replaced with all unique combinations of
#' \code{categories} and \code{variants} entries, assuming both are used in the dynamic entry's name
#' (e.g., \code{"variable_{category}_{variant}"}). See Examples.
#' @section Reference Entries:
#' Reference entries can be included in a \code{_references} entry, and should have names corresponding to
#' those included in any of the measures' \code{citation} entries. These can include any of these entries:
#' \itemize{
#'   \item \strong{\code{id}}: The reference id, same as the entry name.
#'   \item \strong{\code{author}}: A list or list of lists specifying one or more authors. These can include
#'     entries for \code{given} and \code{family} names.
#'   \item \strong{\code{year}}: Year of the publication.
#'   \item \strong{\code{title}}: Title of the publication.
#'   \item \strong{\code{journal}}: Journal in which the publication appears.
#'   \item \strong{\code{volume}}: Volume number of the journal.
#'   \item \strong{\code{page}}: Page number of the journal.
#'   \item \strong{\code{doi}}: Digital Object Identifier, from which a link is made (\code{https://doi.org/{doi}}).
#'   \item \strong{\code{version}}: Version number of software.
#'   \item \strong{\code{url}}: Link to the publication, alternative to a DOI.
#' }
#' @examples
#' path <- tempfile()
#'
#' # make an initial file
#' data_measure_info(path, "measure name" = list(
#'   measure = "measure name",
#'   full_name = "prefix:measure name",
#'   short_description = "A measure.",
#'   statement = "This entity has {value} measure units."
#' ), verbose = FALSE)
#'
#' # add another measure to that
#' measure_info <- data_measure_info(path, "measure two" = list(
#'   measure = "measure two",
#'   full_name = "prefix:measure two",
#'   short_description = "Another measure.",
#'   statement = "This entity has {value} measure units."
#' ), verbose = FALSE)
#' names(measure_info)
#'
#' # add a dynamic measure, and make a rendered version
#' measure_info_rendered <- data_measure_info(
#'   path,
#'   "measure {category} {variant.name}" = list(
#'     measure = "measure {category}",
#'     full_name = "{variant}:measure {category}",
#'     short_description = "Another measure ({category}; {variant}).",
#'     statement = "This entity has {value} {category} {variant}s.",
#'     categories = c("a", "b"),
#'     variants = list(u1 = list(default = "U1"), u2 = list(default = "U2"))
#'   ),
#'   render = TRUE, verbose = FALSE
#' )
#' names(measure_info_rendered)
#' measure_info_rendered[["measure a u1"]]$statement
#' @return An invisible list containing measurement metadata (the rendered version if made).
#' @export

data_measure_info <- function(
  path,
  ...,
  info = list(),
  references = list(),
  strict = FALSE,
  include_empty = TRUE,
  overwrite_entry = FALSE,
  render = NULL,
  overwrite = FALSE,
  write = TRUE,
  verbose = TRUE,
  open_after = interactive()
) {
  if (write) {
    if (missing(path) || !is.character(path)) {
      cli_abort("enter a path to the measure_info.json file as {.arg path}")
    }
    dir.create(dirname(path), FALSE, TRUE)
  }
  built <- list()
  if (!overwrite && is.character(path) && file.exists(path)) {
    if (verbose) {
      cli_bullets(c(i = "updating existing file: {.path {basename(path)}}"))
    }
    built <- jsonlite::read_json(path)
    if (all(c("measure", "measure_type") %in% names(built))) {
      built <- list(built)
      names(built) <- built[[1]]$measure
    }
  }
  if (length(references)) {
    references <- c(references, built$`_references`)
    references <- references[!duplicated(names(references))]
    built$`_references` <- references
  } else {
    references <- built$`_references`
  }
  defaults <- list(
    measure = "",
    full_name = "",
    short_name = "",
    long_name = "",
    category = "",
    short_description = "",
    long_description = "",
    statement = "",
    measure_type = "",
    unit = "",
    time_resolution = "",
    sources = list(),
    citations = list(),
    layer = list()
  )
  if (!is.list(info)) info <- sapply(info, function(name) list())
  info <- c(list(...), info)
  if (length(info) && is.null(names(info))) {
    cli_abort("supplied measure entries must be named")
  }
  for (n in names(info)) {
    if (overwrite_entry || is.null(built[[n]])) {
      l <- info[[n]]
    } else {
      l <- c(info[[n]], built[[n]])
      l <- l[!duplicated(names(l))]
    }
    if (is.null(l$full_name)) l$full_name <- n
    if (strict) {
      su <- names(l) %in% names(defaults)
      if (verbose && any(!su)) {
        cli_warn(paste0(
          "unrecognized {?entry/entries} in ",
          n,
          ": {names(l)[!su]}"
        ))
      }
      if (include_empty) {
        for (e in names(l)) {
          if (!is.null(defaults[[e]])) {
            defaults[[e]] <- l[[e]]
          }
        }
        l <- defaults
      } else {
        l <- l[su]
      }
    } else if (include_empty) {
      su <- !names(defaults) %in% names(l)
      if (any(su)) l <- c(l, defaults[su])
    }
    if (!is.null(l$categories) && !is.list(l$categories)) {
      l$categories <- structure(
        lapply(l$categories, function(e) list(default = e)),
        names = l$categories
      )
    }
    if (!is.null(l$variants) && !is.list(l$variants)) {
      l$variants <- structure(
        lapply(l$variants, function(e) list(default = e)),
        names = l$categories
      )
    }
    if (verbose && !is.null(l$citations)) {
      su <- !l$citations %in% names(references)
      if (any(su)) {
        cli_warn(
          "no matching reference entry for {.val {l$citations[su]}} in {.val {n}}"
        )
      }
    }
    built[[n]] <- l
  }
  built <- built[order(grepl("^_", names(built)))]
  if (write) {
    if (verbose) cli_bullets(c(i = "writing info to {.path {path}}"))
    jsonlite::write_json(built, path, auto_unbox = TRUE, pretty = TRUE)
  }
  if (!is.null(render)) {
    expanded <- list()
    for (name in names(built)) {
      expanded <- c(
        expanded,
        if (grepl("{", name, fixed = TRUE)) {
          render_info(built[name])
        } else {
          structure(list(built[[name]]), names = name)
        }
      )
    }
    changed <- !identical(built, expanded)
    built <- expanded
    if (write && changed) {
      path <- if (is.character(render)) {
        render
      } else {
        sub("\\.json", "_rendered.json", path, TRUE)
      }
      if (verbose) cli_bullets(c(i = "writing rendered info to {.path {path}}"))
      jsonlite::write_json(built, path, auto_unbox = TRUE, pretty = TRUE)
    }
  }
  if (open_after) navigateToFile(path)
  invisible(built)
}
